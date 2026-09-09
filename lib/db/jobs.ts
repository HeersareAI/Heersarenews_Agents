import { getDb } from "@/lib/mongodb";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancel_requested"
  | "cancelled";

export interface JobEvent {
  type: string;
  payload: unknown;
  createdAt: Date;
}

export interface Job {
  _id?: string;
  jobId: string;
  query: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  output?: Record<string, unknown>;
  events: JobEvent[];
  parentJobId?: string | null;
}

function jobsCollection() {
  return getDb().then((db) => db.collection<Job>("jobs"));
}

export async function createJob(
  query: string,
  parentJobId?: string | null
): Promise<Job> {
  const jobId = crypto.randomUUID();
  const now = new Date();
  const job: Job = {
    jobId,
    query,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    events: [{ type: "created", payload: { query }, createdAt: now }],
    parentJobId: parentJobId ?? null,
  };

  const collection = await jobsCollection();
  await collection.insertOne(job);
  return job;
}

export async function getJob(jobId: string): Promise<Job | null> {
  const collection = await jobsCollection();
  return collection.findOne({ jobId });
}

export interface JobListPage {
  jobs: Job[];
  total: number;
}

export async function listJobs({
  page,
  limit,
}: {
  page: number;
  limit: number;
}): Promise<JobListPage> {
  const collection = await jobsCollection();
  const skip = (page - 1) * limit;
  const [jobs, total] = await Promise.all([
    collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(),
  ]);
  return { jobs, total };
}

export interface JobStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  activeJobs: number;
  averageEditorScore: number | null;
  recentJobs: { jobId: string; query: string; status: JobStatus; createdAt: Date }[];
}

export async function getJobStats(): Promise<JobStats> {
  const collection = await jobsCollection();

  const [
    totalJobs,
    completedJobs,
    failedJobs,
    cancelledJobs,
    activeJobs,
    scoredJobs,
    recentJobs,
  ] = await Promise.all([
    collection.countDocuments(),
    collection.countDocuments({ status: "completed" }),
    collection.countDocuments({ status: "failed" }),
    collection.countDocuments({ status: "cancelled" }),
    collection.countDocuments({ status: { $in: ["queued", "running", "cancel_requested"] } }),
    collection
      .find({ "output.editor.score": { $exists: true } })
      .project({ "output.editor.score": 1 })
      .toArray(),
    collection
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .project({ jobId: 1, query: 1, status: 1, createdAt: 1 })
      .toArray(),
  ]);

  const scores = scoredJobs
    .map((job) => Number((job.output as { editor?: { score?: number } })?.editor?.score))
    .filter((score) => Number.isFinite(score));

  const averageEditorScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return {
    totalJobs,
    completedJobs,
    failedJobs,
    cancelledJobs,
    activeJobs,
    averageEditorScore,
    recentJobs: recentJobs.map((job) => ({
      jobId: job.jobId,
      query: job.query,
      status: job.status,
      createdAt: job.createdAt,
    })),
  };
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  output?: Record<string, unknown>
): Promise<void> {
  const collection = await jobsCollection();
  const update: Record<string, unknown> = {
    $set: { status, updatedAt: new Date() },
    $push: { events: { type: "status_changed", payload: { status }, createdAt: new Date() } },
  };
  if (output) {
    update.$set = { ...(update.$set as object), output };
  }
  await collection.updateOne({ jobId }, update);
}

export async function appendJobOutput(
  jobId: string,
  stage: string,
  data: unknown
): Promise<void> {
  const collection = await jobsCollection();
  await collection.updateOne(
    { jobId },
    {
      $set: { updatedAt: new Date() },
      $push: {
        events: { type: "stage_complete", payload: { stage, data }, createdAt: new Date() },
      },
    }
  );
}

export async function appendJobTiming(
  jobId: string,
  stage: string,
  durationMs: number
): Promise<void> {
  const collection = await jobsCollection();
  await collection.updateOne(
    { jobId },
    {
      $set: {
        updatedAt: new Date(),
        [`output.timings.${stage}`]: durationMs,
      },
    }
  );
}

export async function deleteJob(jobId: string): Promise<boolean> {
  const collection = await jobsCollection();
  const result = await collection.deleteOne({ jobId });
  return result.deletedCount > 0;
}

export async function requestJobCancel(jobId: string): Promise<boolean> {
  const collection = await jobsCollection();
  const result = await collection.updateOne(
    { jobId, status: { $nin: ["completed", "failed", "cancelled"] } },
    {
      $set: { status: "cancel_requested", updatedAt: new Date() },
      $push: {
        events: { type: "cancel_requested", payload: {}, createdAt: new Date() },
      },
    }
  );
  return result.matchedCount > 0;
}

export async function isJobCancelled(jobId: string): Promise<boolean> {
  const collection = await jobsCollection();
  const job = await collection.findOne(
    { jobId },
    { projection: { status: 1 } }
  );
  return job?.status === "cancel_requested" || job?.status === "cancelled";
}

export async function finalizeJobCancellation(jobId: string): Promise<void> {
  const collection = await jobsCollection();
  await collection.updateOne(
    { jobId, status: "cancel_requested" },
    {
      $set: { status: "cancelled", updatedAt: new Date() },
      $push: {
        events: { type: "cancelled", payload: {}, createdAt: new Date() },
      },
    }
  );
}
