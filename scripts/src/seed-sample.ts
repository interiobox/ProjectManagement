/**
 * Seed script — fills the database with realistic architecture-firm sample data.
 * Run: pnpm --filter @workspace/scripts run seed-sample
 */
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  projectsTable,
  categoriesTable,
  tasksTable,
  taskAssigneesTable,
  notesTable,
  personalNotesTable,
  filesTable,
  fileUploadLogsTable,
  activityLogsTable,
} from "@workspace/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function futureDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function pastDate(n: number) {
  return daysAgo(n).toISOString().split("T")[0];
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pick<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// ── Users ─────────────────────────────────────────────────────────────────────

const PW = await bcrypt.hash("password123", 10);

await db
  .insert(usersTable)
  .values([
    { name: "Sarah Chen",      email: "sarah.chen@archfirm.com",      passwordHash: PW, role: "admin"  },
    { name: "Marcus Rodriguez",email: "marcus.rodriguez@archfirm.com", passwordHash: PW, role: "member" },
    { name: "Emily Watson",    email: "emily.watson@archfirm.com",     passwordHash: PW, role: "member" },
    { name: "James Kim",       email: "james.kim@archfirm.com",        passwordHash: PW, role: "member" },
    { name: "Lisa Patel",      email: "lisa.patel@archfirm.com",       passwordHash: PW, role: "member" },
    { name: "Tom Okonkwo",     email: "tom.okonkwo@archfirm.com",      passwordHash: PW, role: "member" },
  ])
  .onConflictDoNothing();

const users = await db
  .select()
  .from(usersTable)
  .where(
    inArray(usersTable.email, [
      "sarah.chen@archfirm.com",
      "marcus.rodriguez@archfirm.com",
      "emily.watson@archfirm.com",
      "james.kim@archfirm.com",
      "lisa.patel@archfirm.com",
      "tom.okonkwo@archfirm.com",
    ])
  )
  .orderBy(usersTable.id);

const [sarah, marcus, emily, james, lisa, tom] = users;
const allUsers = users;
console.log(`✓ ${users.length} users created`);

// Also grab the existing admin user so we can reference it
const [adminUser] = await db.select().from(usersTable)
  .where(eq(usersTable.email, "admin@archfirm.com"));

// ── Projects ──────────────────────────────────────────────────────────────────

const projects = await db
  .insert(projectsTable)
  .values([
    {
      name: "Riverside Residences",
      description: "12-unit luxury residential development on the eastern riverfront. Features rooftop terraces, underground parking, and LEED Gold certification target.",
      status: "active",
      createdById: sarah.id,
    },
    {
      name: "Harbor View Office Tower",
      description: "22-storey commercial high-rise in the CBD. Mixed office and retail podium with a sky lobby on level 14. Client: Meridian Property Group.",
      status: "active",
      createdById: sarah.id,
    },
    {
      name: "Greenfield Community Center",
      description: "Public community center for the City of Greenfield. Includes gymnasium, library wing, childcare facilities, and outdoor amphitheater.",
      status: "active",
      createdById: marcus.id,
    },
    {
      name: "Old Town Hotel Renovation",
      description: "Heritage restoration and adaptive reuse of a 1920s warehouse into a 68-room boutique hotel. Heritage overlay requires council approval at each stage.",
      status: "on_hold",
      createdById: emily.id,
    },
    {
      name: "Westside Mixed-Use Development",
      description: "Transit-oriented development above the new Westside metro station. 180 apartments, ground-floor retail, and a public plaza.",
      status: "active",
      createdById: sarah.id,
    },
    {
      name: "Northgate Industrial Precinct",
      description: "Master plan for a 4.2ha light-industrial precinct. 8 warehouse units, shared amenities building, and EV charging infrastructure.",
      status: "completed",
      createdById: marcus.id,
    },
  ])
  .returning();

console.log(`✓ ${projects.length} projects created`);

// ── Categories (per project) ──────────────────────────────────────────────────

async function seedCategories(projectId: number) {
  return db.insert(categoriesTable).values([
    { name: "Design",           color: "#6366f1", projectId },
    { name: "Structural",       color: "#f59e0b", projectId },
    { name: "MEP",              color: "#10b981", projectId },
    { name: "Documentation",    color: "#3b82f6", projectId },
    { name: "Site & Construction", color: "#ef4444", projectId },
    { name: "Client & Approvals",  color: "#8b5cf6", projectId },
  ]).returning();
}

const categoriesByProject: Record<number, Awaited<ReturnType<typeof seedCategories>>> = {};
for (const p of projects) {
  categoriesByProject[p.id] = await seedCategories(p.id);
}
console.log(`✓ categories created`);

// ── Tasks ─────────────────────────────────────────────────────────────────────

const statuses = ["todo", "in_progress", "review", "done"] as const;
const priorities = ["low", "medium", "high", "urgent"] as const;

interface TaskDef {
  title: string;
  description: string;
  status: typeof statuses[number];
  priority: typeof priorities[number];
  catIndex: number; // index into the project's categories
  dueOffset: number | null; // days from today (+ future, - past)
}

const taskTemplates: TaskDef[] = [
  // Design
  { title: "Develop concept design package",              description: "Prepare concept drawings, massing models, and design narrative for client presentation. Include 3 design directions.",                                 status: "done",        priority: "high",   catIndex: 0, dueOffset: -40 },
  { title: "Schematic design — floor plan refinement",   description: "Refine floor plans based on client feedback from concept presentation. Incorporate additional storage requirements.",                                   status: "done",        priority: "high",   catIndex: 0, dueOffset: -25 },
  { title: "Design development drawings",                description: "Produce design development drawing set including plans, elevations, sections, and key details at 1:100.",                                               status: "in_progress", priority: "high",   catIndex: 0, dueOffset: 14 },
  { title: "3D visualisation renders",                   description: "Coordinate with visualisation studio for 4 hero renders and 1 fly-through animation. Provide model and material schedule.",                            status: "in_progress", priority: "medium", catIndex: 0, dueOffset: 10 },
  { title: "Interior material schedule",                 description: "Compile full interior finishes schedule including FF&E selections, tile layouts, and joinery details.",                                                 status: "todo",        priority: "medium", catIndex: 0, dueOffset: 21 },
  { title: "Facade system specification",                description: "Specify external cladding system, glazing types, and sun-shading strategy. Coordinate with thermal consultant.",                                       status: "todo",        priority: "high",   catIndex: 0, dueOffset: 28 },

  // Structural
  { title: "Structural engineer engagement",             description: "Issue RFP to three structural engineering firms. Evaluate proposals and recommend appointment to client.",                                              status: "done",        priority: "high",   catIndex: 1, dueOffset: -60 },
  { title: "Column grid coordination",                   description: "Coordinate structural column grid with architectural layout. Resolve conflicts between columns and open-plan areas.",                                   status: "done",        priority: "high",   catIndex: 1, dueOffset: -20 },
  { title: "Foundation report review",                   description: "Review geotechnical report and confirm foundation system with structural engineer. Check for contamination flags.",                                     status: "in_progress", priority: "urgent", catIndex: 1, dueOffset: 5  },
  { title: "Transfer slab design coordination",         description: "Coordinate transfer structure at podium level. Confirm slab depth and review impact on car park head heights.",                                         status: "todo",        priority: "high",   catIndex: 1, dueOffset: 18 },
  { title: "Steel connection details",                   description: "Review and approve structural steel connection details for roof trusses and canopy structures.",                                                        status: "todo",        priority: "medium", catIndex: 1, dueOffset: 30 },

  // MEP
  { title: "Hydraulic consultant brief",                 description: "Prepare hydraulic consultant brief covering hot/cold water, stormwater, fire services, and sustainability targets.",                                    status: "done",        priority: "medium", catIndex: 2, dueOffset: -50 },
  { title: "Mechanical services coordination",           description: "Coordinate ductwork routes with ceiling void space. Resolve clashes between mechanical and structural elements in BIM.",                               status: "in_progress", priority: "high",   catIndex: 2, dueOffset: 8  },
  { title: "Electrical load schedule",                   description: "Review electrical load schedule from ESD consultant. Confirm switchboard locations and cable routes.",                                                 status: "in_progress", priority: "medium", catIndex: 2, dueOffset: 12 },
  { title: "Fire services design coordination",          description: "Coordinate sprinkler grid, hose reel locations, and fire indicator panel position with fire services engineer.",                                       status: "todo",        priority: "high",   catIndex: 2, dueOffset: 20 },
  { title: "ESD performance report",                     description: "Commission energy and sustainability design report for planning submission. Confirm NatHERS or Green Star pathway.",                                   status: "todo",        priority: "medium", catIndex: 2, dueOffset: 35 },

  // Documentation
  { title: "Prepare planning permit application",        description: "Compile planning permit application package: architectural drawings, planning report, shadow analysis, materials board, and consultant reports.",       status: "in_progress", priority: "urgent", catIndex: 3, dueOffset: 7  },
  { title: "Construction documentation — shell & core",  description: "Produce shell and core construction document set for building permit. Target 100% CD completion.",                                                     status: "todo",        priority: "high",   catIndex: 3, dueOffset: 45 },
  { title: "Specification writing",                      description: "Author project specification using National Building Specification framework. Coordinate technical sections with engineers.",                           status: "todo",        priority: "medium", catIndex: 3, dueOffset: 50 },
  { title: "BIM model audit",                            description: "Conduct BIM audit against project BIM Execution Plan. Check model health, naming conventions, and clash detection report.",                            status: "review",      priority: "medium", catIndex: 3, dueOffset: 3  },
  { title: "As-built drawings compilation",              description: "Collect and compile as-built drawings from all trade contractors. Reconcile against contract set and issue final record drawings.",                    status: "todo",        priority: "low",    catIndex: 3, dueOffset: 90 },

  // Site & Construction
  { title: "Site establishment inspection",              description: "Attend site establishment and confirm hoarding, site office, materials storage, and traffic management plan compliance.",                               status: "done",        priority: "medium", catIndex: 4, dueOffset: -15 },
  { title: "Concrete pour inspection — level 1 slab",   description: "Attend pre-pour inspection for level 1 suspended slab. Check formwork, reinforcement, and embedments against drawings.",                              status: "done",        priority: "high",   catIndex: 4, dueOffset: -8  },
  { title: "Subcontractor RFI review",                   description: "Review and respond to outstanding RFIs from subcontractors. Prioritise items on the critical path.",                                                  status: "in_progress", priority: "high",   catIndex: 4, dueOffset: 2  },
  { title: "Defects inspection — practical completion",  description: "Carry out practical completion inspection and issue defects list. Set rectification period and schedule re-inspection.",                               status: "todo",        priority: "urgent", catIndex: 4, dueOffset: 6  },
  { title: "Progress claim assessment — CC #4",          description: "Assess contractor's progress claim number 4. Verify works completed against program and schedule of rates.",                                          status: "todo",        priority: "medium", catIndex: 4, dueOffset: 9  },
  { title: "Fire stair construction review",             description: "Inspect fire stair construction on levels 3–6. Check stair dimensions, balustrade fixings, and penetration seals.",                                  status: "review",      priority: "high",   catIndex: 4, dueOffset: 1  },

  // Client & Approvals
  { title: "Client design presentation — stage 2",       description: "Prepare and deliver stage 2 design presentation to client steering committee. Include cost plan update and program.",                                  status: "done",        priority: "high",   catIndex: 5, dueOffset: -30 },
  { title: "Council pre-application meeting",            description: "Arrange and attend pre-application meeting with council planning officer. Prepare questions register and meeting minutes.",                             status: "done",        priority: "high",   catIndex: 5, dueOffset: -22 },
  { title: "Respond to planning permit conditions",      description: "Prepare written response to planning permit conditions. Coordinate consultant endorsements and resubmit amended drawings.",                            status: "in_progress", priority: "urgent", catIndex: 5, dueOffset: 4  },
  { title: "Client sign-off — design development",       description: "Obtain written client sign-off on design development package before proceeding to construction documentation.",                                        status: "review",      priority: "high",   catIndex: 5, dueOffset: 2  },
  { title: "Neighbour notification response",            description: "Review objections received during neighbour notification period. Prepare rebuttal report addressing key concerns.",                                    status: "todo",        priority: "medium", catIndex: 5, dueOffset: 11 },
];

const creatorPool = [sarah, marcus, emily, james, lisa, tom];
const assigneePool = [marcus, emily, james, lisa, tom];

interface CreatedTask { id: number; title: string; projectId: number; }
const allTasks: CreatedTask[] = [];

for (const project of projects) {
  const cats = categoriesByProject[project.id];
  const creator = rand(creatorPool);

  // Use all templates, shuffled, pick 12–18 per project
  const shuffled = [...taskTemplates].sort(() => Math.random() - 0.5).slice(0, 14);

  for (const tpl of shuffled) {
    const cat = cats[tpl.catIndex];
    const assignee = rand(assigneePool);
    const dueDate = tpl.dueOffset === null
      ? null
      : tpl.dueOffset > 0 ? futureDays(tpl.dueOffset) : pastDate(-tpl.dueOffset);

    const [task] = await db.insert(tasksTable).values({
      title: tpl.title,
      description: tpl.description,
      status: tpl.status,
      priority: tpl.priority,
      projectId: project.id,
      categoryId: cat.id,
      assignedToId: assignee.id,
      createdById: creator.id,
      dueDate,
    }).returning();

    allTasks.push({ id: task.id, title: task.title, projectId: project.id });

    // Assign 1–3 additional team members
    const extras = pick(assigneePool.filter(u => u.id !== assignee.id), rand([1, 2]));
    if (extras.length) {
      await db.insert(taskAssigneesTable).values(
        extras.map(u => ({ taskId: task.id, userId: u.id }))
      ).onConflictDoNothing();
    }
  }
}

console.log(`✓ ${allTasks.length} tasks created`);

// ── Notes (task-level) ────────────────────────────────────────────────────────

const noteSnippets = [
  "Confirmed with client — approach is approved, proceed to next stage.",
  "Outstanding: waiting on consultant to provide updated drawings before we can close this out.",
  "Discussed in site meeting 14/07. Contractor to rectify by end of week.",
  "BIM model updated to reflect latest structural changes. Re-run clash detection.",
  "Heritage consultant raised concerns about the proposed window reveal depth. To be resolved at next workshop.",
  "Cost plan shows this item is over budget by ~12%. Need to value-engineer cladding spec.",
  "Council officer confirmed no further information required for this condition.",
  "Samples submitted to client for review. Decision expected by Friday.",
  "Subcontractor substitution approved by superintendent. Updated shop drawings issued.",
  "Program impact: this task is on the critical path. Delay will push PC date.",
  "Action: Marcus to follow up with structural engineer by EOD Wednesday.",
  "Fire engineer has issued preliminary report. A few items to resolve before final sign-off.",
  "Neighbour objection relates to overlooking from level 3 balcony. Shadow diagrams being prepared.",
  "Completed ahead of schedule. All deliverables archived in project folder.",
  "Revised cost estimate received. 8% saving achieved through spec changes.",
];

let noteCount = 0;
for (const task of allTasks) {
  const n = rand([1, 2, 3]);
  for (let i = 0; i < n; i++) {
    const author = rand(allUsers);
    await db.insert(notesTable).values({
      content: rand(noteSnippets),
      projectId: task.projectId,
      taskId: task.id,
      userId: author.id,
    });
    noteCount++;
  }
}

// Project-level notes
for (const project of projects) {
  const projectNotes = [
    `Project kick-off meeting held. All consultants confirmed. Program issued.`,
    `Fee proposal accepted. Signed contract received from client. Archiving original.`,
    `Mid-project review complete. Client satisfied with progress. No scope changes requested.`,
  ];
  for (const content of projectNotes) {
    await db.insert(notesTable).values({
      content,
      projectId: project.id,
      taskId: null,
      userId: rand(allUsers).id,
    });
    noteCount++;
  }
}

console.log(`✓ ${noteCount} notes created`);

// ── Personal Notes ────────────────────────────────────────────────────────────

const personalSnippets = [
  "Follow up with James on the structural report — hasn't responded to last two emails.",
  "Check NCC 2022 requirements for fire-isolated corridors before issuing next drawing set.",
  "Book site visit for Riverside Residences next Tuesday morning.",
  "Draft agenda for fortnightly design coordination meeting.",
  "Review Westside Mixed-Use tender returns before team meeting on Thursday.",
  "Order 1:200 site model base from model-maker — delivery takes 10 days.",
  "Call Lisa re: finish samples for Harbor View client meeting.",
  "Update project program for Old Town Hotel — heritage approval delayed by 3 weeks.",
  "Expense claim due end of month — include site travel receipts.",
  "Prepare quarterly project status report for principal review.",
];

let pnCount = 0;
for (const user of allUsers) {
  const n = rand([2, 3, 4]);
  const chosen = pick(personalSnippets, n);
  for (const content of chosen) {
    await db.insert(personalNotesTable).values({ content, userId: user.id });
    pnCount++;
  }
}
console.log(`✓ ${pnCount} personal notes created`);

// ── Files ─────────────────────────────────────────────────────────────────────

const fileTemplates = [
  { name: "Concept_Design_Report.pdf",        mimeType: "application/pdf",        size: 4_800_000  },
  { name: "Floor_Plans_DD_Rev3.dwg",          mimeType: "application/octet-stream",size: 2_200_000  },
  { name: "Site_Analysis.pdf",                mimeType: "application/pdf",        size: 1_500_000  },
  { name: "Structural_Report_Final.pdf",      mimeType: "application/pdf",        size: 3_100_000  },
  { name: "Elevations_DD_Rev2.pdf",           mimeType: "application/pdf",        size: 980_000    },
  { name: "Material_Schedule_v4.xlsx",        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 320_000 },
  { name: "Construction_Program.xlsx",        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 145_000 },
  { name: "Site_Photo_Progress_01.jpg",       mimeType: "image/jpeg",             size: 2_900_000  },
  { name: "Site_Photo_Progress_02.jpg",       mimeType: "image/jpeg",             size: 3_100_000  },
  { name: "Geotechnical_Report.pdf",          mimeType: "application/pdf",        size: 5_200_000  },
  { name: "Hydraulic_Design_Brief.pdf",       mimeType: "application/pdf",        size: 890_000    },
  { name: "Sections_Rev1.pdf",                mimeType: "application/pdf",        size: 760_000    },
  { name: "BIM_Clash_Report.pdf",             mimeType: "application/pdf",        size: 1_100_000  },
  { name: "Client_Presentation_Stage2.pptx",  mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size: 18_500_000 },
  { name: "RFI_Register.xlsx",               mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 220_000 },
  { name: "Specification_Draft.docx",        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1_800_000 },
  { name: "Permit_Application_Drawings.pdf", mimeType: "application/pdf",        size: 12_300_000 },
  { name: "Cost_Plan_Rev2.xlsx",             mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 480_000  },
];

let fileCount = 0;
// Attach 2–4 files to a random ~60% of tasks
const tasksWithFiles = pick(allTasks, Math.floor(allTasks.length * 0.6));

for (const task of tasksWithFiles) {
  const n = rand([2, 3, 4]);
  const chosen = pick(fileTemplates, n);

  for (const tpl of chosen) {
    const uploader = rand(allUsers);
    const version = rand([1, 1, 1, 2, 2, 3]);

    for (let v = 1; v <= version; v++) {
      const [file] = await db.insert(filesTable).values({
        name: tpl.name,
        mimeType: tpl.mimeType,
        size: tpl.size,
        version: v,
        url: `https://drive.google.com/file/d/sample-${task.id}-${tpl.name.replace(/\s/g, "_")}-v${v}/view`,
        taskId: task.id,
        uploadedById: uploader.id,
      }).returning();

      await db.insert(fileUploadLogsTable).values({
        fileId: file.id,
        taskId: task.id,
        projectId: task.projectId,
        name: tpl.name,
        mimeType: tpl.mimeType,
        size: tpl.size,
        version: v,
        url: file.url,
        uploadedById: uploader.id,
        createdAt: file.createdAt,
      });

      fileCount++;
    }
  }
}

console.log(`✓ ${fileCount} file versions created`);

// ── Activity Logs ─────────────────────────────────────────────────────────────

const taskActions = [
  "created task", "updated task", "changed status to in_progress",
  "changed status to review", "changed status to done",
  "updated priority to urgent", "added assignee", "updated due date",
];
const fileActions = ["uploaded file", "uploaded file version 2", "uploaded file version 3", "removed file"];
const projectActions = ["created project", "updated project description", "changed status to active"];

let actCount = 0;

for (const project of projects) {
  // Project-level events
  for (const action of pick(projectActions, 2)) {
    await db.insert(activityLogsTable).values({
      action,
      entityType: "project",
      entityId: project.id,
      entityName: project.name,
      projectId: project.id,
      userId: rand(allUsers).id,
    });
    actCount++;
  }
}

for (const task of allTasks) {
  const n = rand([2, 3, 4, 5]);
  for (let i = 0; i < n; i++) {
    await db.insert(activityLogsTable).values({
      action: rand(taskActions),
      entityType: "task",
      entityId: task.id,
      entityName: task.title,
      projectId: task.projectId,
      userId: rand(allUsers).id,
    });
    actCount++;
  }
}

// A few file-related activity entries
for (const task of pick(tasksWithFiles, 20)) {
  await db.insert(activityLogsTable).values({
    action: rand(fileActions),
    entityType: "file",
    entityId: task.id,
    entityName: `${rand(fileTemplates).name}`,
    projectId: task.projectId,
    userId: rand(allUsers).id,
  });
  actCount++;
}

console.log(`✓ ${actCount} activity log entries created`);
console.log("\n✅ Seed complete!");
console.log(`   Login with any new user: password123`);
