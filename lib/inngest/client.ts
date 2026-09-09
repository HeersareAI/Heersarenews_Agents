import { Inngest } from "inngest";

const isDev =
  process.env.NODE_ENV === "development" && !process.env.INNGEST_SIGNING_KEY;

export const inngest = new Inngest({
  id: "ai-multi-news",
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
  signingKey: process.env.INNGEST_SIGNING_KEY || undefined,
  isDev,
});

export type NewsJobCreated = {
  name: "news/job.created";
  data: {
    jobId: string;
    query: string;
  };
};
