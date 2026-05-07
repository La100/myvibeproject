import { mutation } from "./_generated/server";

const DEMO_PROJECT_SLUG = "demo-project";
const DEMO_COVER_IMAGE = "/landing/generated/editorial-studio-hero-web.png";

const moodboardImages = [
  ["Warm interior concept", "concept-direction", "/landing/generated/editorial-studio-hero-web.png"],
  ["Lounge furniture direction", "concept-direction", "/landing/generated/barcelona-chair-room.png"],
  ["Green zellige wall finish", "materials-finishes", "/landing/generated/green-zellige-interior.png"],
  ["Terracotta hallway tile", "materials-finishes", "/landing/generated/terracotta-tile-hallway.png"],
  ["Cream boucle swivel chair", "furniture-lighting", "/landing/generated/cream-boucle-swivel-chair.png"],
  ["Leather stone and walnut palette", "furniture-lighting", "/landing/generated/barcelona-chair-materials.png"],
] as const;

export const fixDemoInteriorImages = mutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("slug"), DEMO_PROJECT_SLUG))
      .collect();

    for (const project of projects) {
      await ctx.db.patch(project._id, {
        coverImageUrl: DEMO_COVER_IMAGE,
      });

      const files = await ctx.db
        .query("files")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .filter((q) => q.neq(q.field("moodboardSection"), undefined))
        .collect();

      const sortedFiles = [...files].sort(
        (a, b) =>
          (a.moodboardOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.moodboardOrder ?? Number.MAX_SAFE_INTEGER) ||
          a._creationTime - b._creationTime,
      );

      for (const [index, [name, section, storageId]] of moodboardImages.entries()) {
        const existingFile = sortedFiles[index];
        if (existingFile) {
          await ctx.db.patch(existingFile._id, {
            name,
            description: "Demo moodboard image",
            storageId,
            size: 900000,
            mimeType: "image/png",
            fileType: "image",
            moodboardSection: section,
            moodboardOrder: index,
            showInClientPortal: true,
          });
        } else {
          await ctx.db.insert("files", {
            name,
            description: "Demo moodboard image",
            teamId: project.teamId,
            projectId: project._id,
            fileType: "image",
            storageId,
            size: 900000,
            mimeType: "image/png",
            uploadedBy: project.createdBy,
            version: 1,
            isLatest: true,
            origin: "general",
            moodboardSection: section,
            moodboardOrder: index,
            showInClientPortal: true,
            aiKnowledgeEnabled: false,
            aiKnowledgeStatus: "excluded",
          });
        }
      }
    }

    return { updatedProjects: projects.length };
  },
});
