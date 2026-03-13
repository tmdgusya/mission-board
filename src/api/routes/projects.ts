import { Hono } from "hono";
import { db } from "../../db/connection";
import { projects } from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdSchema,
} from "../../schemas/projects";

const projectsRouter = new Hono();

// POST /api/projects - Create a new project
projectsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Validate input
    const validationResult = createProjectSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { name, description } = validationResult.data;
    const now = new Date();
    const projectId = crypto.randomUUID();

    // Insert project
    await db.insert(projects).values({
      id: projectId,
      name,
      description: description || null,
      createdAt: now,
      updatedAt: now,
    });

    // Fetch the created project
    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (result.length === 0) {
      return c.json({ error: "Failed to create project" }, 500);
    }

    const project = result[0]!;
    return c.json(
      {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      201
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    console.error("Error creating project:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/projects - List all projects
projectsRouter.get("/", async (c) => {
  try {
    const result = await db.select().from(projects);

    const projectsList = result.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));

    return c.json(projectsList);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/projects/:id - Get a single project
projectsRouter.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = projectIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));

    if (result.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    const project = result[0]!;
    return c.json({
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/projects/:id - Update a project
projectsRouter.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = projectIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    const body = await c.req.json();

    // Validate input
    const validationResult = updateProjectSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const updates = validationResult.data;

    // Check if project exists
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));

    if (existingProject.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Prepare update values
    const updateValues: Partial<{
      name: string;
      description: string | null;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) {
      updateValues.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateValues.description = updates.description;
    }

    // Update project
    await db.update(projects).set(updateValues).where(eq(projects.id, id));

    // Fetch updated project
    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));

    const project = result[0]!;
    return c.json({
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    console.error("Error updating project:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/projects/:id - Delete a project (cascade)
projectsRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = projectIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    // Check if project exists
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));

    if (existingProject.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Delete project (cascade will handle related records)
    await db.delete(projects).where(eq(projects.id, id));

    return c.body(null, 204);
  } catch (error) {
    console.error("Error deleting project:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { projectsRouter };
