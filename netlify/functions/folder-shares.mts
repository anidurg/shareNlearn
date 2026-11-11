// Folder-sharing administration. Every mutation is checked against current
// Circle admin membership; an approved reference never grants membership.
import type { Config, Context } from "@netlify/functions";
import { and, eq, or } from "drizzle-orm";
import { admittedAccess } from "../lib/access.js";
import { db } from "../../db/index.js";
import { circles, folderShares, folderShareEvents, folderShareExclusions } from "../../db/schema.js";
import { folderById, foldersOf, subtreeIds } from "../lib/folders.js";
import { moderatorOf } from "../lib/moderation.js";
import { badRequest, jsonBody, unauthorized } from "../lib/items.js";

const validId = (v: unknown) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const forbidden = () => Response.json({ error: "Circle admin access required." }, { status: 403 });
const conflict = (message: string) => Response.json({ error: message }, { status: 409 });

export default async (req: Request, context: Context) => {
  const access = await admittedAccess();
  if (!access) return unauthorized();
  const circleId = validId(context.params.circleId);
  if (!circleId) return badRequest("Invalid Circle.");
  const [circle] = await db.select().from(circles).where(eq(circles.id, circleId));
  if (!circle) return Response.json({ error: "Circle not found." }, { status: 404 });
  if (!(await moderatorOf(circleId, access))) return forbidden();

  if (req.method === "GET") {
    const shares = await db.select().from(folderShares).where(
      or(eq(folderShares.sourceCircleId, circleId), eq(folderShares.destinationCircleId, circleId)),
    );
    return Response.json({ shares });
  }

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  if (req.method === "POST") {
    const folderId = validId(body.folderId);
    const destinationId = validId(body.destinationCircleId);
    if (!folderId || !destinationId || destinationId === circleId)
      return badRequest("Choose a source folder and another Circle.");
    const folder = await folderById(circleId, folderId);
    if (!folder || folder.status !== "active") return badRequest("Source folder is unavailable.");
    const [destination] = await db.select().from(circles).where(eq(circles.id, destinationId));
    if (!destination) return badRequest("Destination Circle not found.");
    const permission = body.permission === "contribute" ? "contribute" : "view";
    const current = await db.select().from(folderShares).where(and(
      eq(folderShares.sourceFolderId, folderId),
      eq(folderShares.destinationCircleId, destinationId),
    ));
    if (current.some((s) => s.status === "pending" || s.status === "active"))
      return conflict("A request or active share already exists for this destination.");
    const [created] = await db.insert(folderShares).values({
      sourceFolderId: folderId, sourceCircleId: circleId, destinationCircleId: destinationId,
      requestedById: access.user.id, sourceApprovedById: access.user.id, permission,
    }).returning();
    await db.insert(folderShareEvents).values({
      shareId: created.id, actorId: access.user.id, action: "requested",
    });
    return Response.json({ share: created }, { status: 201 });
  }

  if (req.method !== "PATCH") return Response.json({ error: "Method not allowed." }, { status: 405 });
  const shareId = validId(body.shareId);
  if (!shareId) return badRequest("Invalid sharing request.");
  const [share] = await db.select().from(folderShares).where(eq(folderShares.id, shareId));
  if (!share || (share.sourceCircleId !== circleId && share.destinationCircleId !== circleId))
    return Response.json({ error: "Sharing request not found." }, { status: 404 });

  const sourceAdmin = share.sourceCircleId === circleId;
  const destinationAdmin = share.destinationCircleId === circleId;
  const action = String(body.action ?? "");

  if (action === "revoke" || action === "cancel") {
    if (action === "cancel" && (!sourceAdmin || share.status !== "pending"))
      return conflict("Only the source admin can cancel a pending request.");
    if (action === "revoke" && share.status !== "active") return conflict("Share is not active.");
    const status = action === "cancel" ? "cancelled" : "revoked";
    const [updated] = await db.update(folderShares).set({ status, endedAt: new Date() })
      .where(and(eq(folderShares.id, shareId), eq(folderShares.status, share.status))).returning();
    if (!updated) return conflict("Sharing status changed. Refresh and retry.");
    await db.insert(folderShareEvents).values({ shareId, actorId: access.user.id, action: status });
    return Response.json({ share: updated });
  }

  if (action === "reject") {
    if (!destinationAdmin || share.status !== "pending") return conflict("Only a pending destination request can be rejected.");
    const [updated] = await db.update(folderShares).set({ status: "rejected", endedAt: new Date() })
      .where(and(eq(folderShares.id, shareId), eq(folderShares.status, "pending"))).returning();
    if (!updated) return conflict("Request has changed.");
    await db.insert(folderShareEvents).values({ shareId, actorId: access.user.id, action: "rejected" });
    return Response.json({ share: updated });
  }

  if (action === "approve") {
    if (!destinationAdmin || share.status !== "pending") return conflict("Only a destination admin can approve a pending request.");
    const parentId = body.parentId == null ? null : validId(body.parentId);
    if (body.parentId != null && !parentId) return badRequest("Invalid destination folder.");
    if (parentId && !(await folderById(circleId, parentId))) return badRequest("Destination folder does not belong to this Circle.");
    const source = await folderById(share.sourceCircleId, share.sourceFolderId);
    if (!source || source.status !== "active") return conflict("Source folder is no longer available.");
    const [updated] = await db.update(folderShares).set({
      status: "active", destinationApprovedById: access.user.id,
      destinationParentFolderId: parentId, activatedAt: new Date(),
    }).where(and(eq(folderShares.id, shareId), eq(folderShares.status, "pending"))).returning();
    if (!updated) return conflict("Request has changed.");
    await db.insert(folderShareEvents).values({ shareId, actorId: access.user.id, action: "approved" });
    return Response.json({ share: updated });
  }

  if (action === "permission") {
    if (!sourceAdmin || share.status !== "active") return forbidden();
    // Upgrades require a fresh destination approval; never silently elevate.
    if (body.permission !== "view") return badRequest("Permission increases require a new approval workflow.");
    const [updated] = await db.update(folderShares).set({ permission: "view" })
      .where(and(eq(folderShares.id, shareId), eq(folderShares.status, "active"))).returning();
    if (!updated) return conflict("Share has changed.");
    await db.insert(folderShareEvents).values({ shareId, actorId: access.user.id, action: "permission_reduced" });
    return Response.json({ share: updated });
  }

  if (action === "exclude") {
    if (!sourceAdmin || share.status !== "active") return forbidden();
    const folderId = validId(body.folderId);
    if (!folderId || folderId === share.sourceFolderId) return badRequest("Choose a subfolder.");
    const rows = await foldersOf(share.sourceCircleId);
    if (!subtreeIds(rows, share.sourceFolderId).includes(folderId)) return badRequest("Folder is not inside the shared tree.");
    if (body.excluded === true) {
      await db.insert(folderShareExclusions).values({ shareId, folderId }).onConflictDoNothing();
    } else if (body.excluded === false) {
      await db.delete(folderShareExclusions).where(and(
        eq(folderShareExclusions.shareId, shareId), eq(folderShareExclusions.folderId, folderId),
      ));
    } else return badRequest("Specify excluded true or false.");
    await db.insert(folderShareEvents).values({ shareId, actorId: access.user.id, action: "exclusions_changed", details: String(folderId) });
    return Response.json({ ok: true });
  }

  return badRequest("Unknown sharing action.");
};

export const config: Config = {
  path: "/api/circles/:circleId/folder-shares",
  method: ["GET", "POST", "PATCH"],
};
