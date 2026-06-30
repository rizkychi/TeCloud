import { csrfResponse } from "../../../../lib/request-guards";

export async function GET() {
  return csrfResponse();
}
