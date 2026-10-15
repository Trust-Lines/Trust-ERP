import {
  ATTACHMENT_CHUNK_BYTES, ATTACHMENT_SINGLE_MAX_BYTES, PROJECT_TYPE_MAP, TIMING_MAP, type Companion, type SurveyData,
} from "./constants";


// Phone photos are 3–10 MB; shrink to a sane JPEG so the upload fits and is fast on booth Wi-Fi.
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. HEIC the browser can't decode — send as-is, server limit still applies
  }
}

export async function postAttachmentPart(url: string, fields: Record<string, string>, part: Blob, partName: string, fileName: string) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append(partName, part, fileName);
  const res = await fetch(url, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Upload failed");
  return body as { sessionId?: string };
}

// A flaky booth connection shouldn't lose a 200 MB file over one dropped chunk.
export async function sendWithRetry<T>(send: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await send();
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

// Small files go up in one request; anything bigger is sent in chunks (the server relays them
// into a Dropbox upload session) because a single request body is capped at ~4.5 MB.
export async function uploadAttachment(
  campaignSlug: string, submissionId: string, token: string, file: File, onProgress: (fraction: number) => void
) {
  const url = `/api/public/campaigns/${campaignSlug}/submissions/${submissionId}/attachments`;
  if (file.size <= ATTACHMENT_SINGLE_MAX_BYTES) {
    await postAttachmentPart(url, { token }, file, "file", file.name);
    onProgress(1);
    return;
  }
  let offset = 0;
  let sessionId = "";
  while (offset < file.size) {
    const end = Math.min(offset + ATTACHMENT_CHUNK_BYTES, file.size);
    const last = end === file.size;
    const action = offset === 0 ? "start" : last ? "finish" : "append";
    const fields: Record<string, string> = { token, action, offset: String(offset), fileName: file.name };
    if (sessionId) fields.sessionId = sessionId;
    const result = await sendWithRetry(() => postAttachmentPart(url, fields, file.slice(offset, end), "chunk", file.name));
    if (action === "start") {
      sessionId = result.sessionId ?? "";
      if (!sessionId) throw new Error("Upload failed");
    }
    offset = end;
    onProgress(offset / file.size);
  }
}

export function buildSubmissionPayload(team: string, data: SurveyData, submissionToken: string, consentTextVersion: string, companions: Companion[]) {
  const [firstName, ...rest] = (data.fullName || "").trim().split(/\s+/);
  const notesLines = [
    data.representative ? `Entered by: ${data.representative}` : null,
    team ? `Team: ${team}` : null,
    data.contactPreference ? `Preferred contact: ${data.contactPreference.split("|").join(", ")}` : null,
    data.storeStatus ? `Store status: ${data.storeStatus}` : null,
    data.storeSize ? `Store size: ${data.storeSize}` : null,
    data.storeNeed ? `Project scope: ${data.storeNeed}` : null,
    data.mainChallenges ? `Notes: ${data.mainChallenges}` : null
  ].filter(Boolean);
  // Only the person's name is mandatory — without a store name the lead is saved as a
  // person (the backend rejects an "organization" lead with no organization name).
  const hasCompany = !!data.companyName.trim();
  const namedCompanions = companions
    .map((c) => ({ name: c.name.trim(), title: c.title.trim() || undefined, phone: c.phone.trim() || undefined, email: c.email.trim() || undefined }))
    .filter((c) => c.name);

  return {
    leadType: hasCompany ? ("organization" as const) : ("person" as const),
    organizationName: hasCompany ? data.companyName : undefined,
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
    email: data.email || undefined,
    phone: data.phone || undefined,
    jobTitle: data.position || undefined,
    city: data.companyAddress || undefined,
    storeAddress: data.companyAddress || undefined,
    team: team || undefined,
    representative: data.representative || undefined,
    projectTypes: PROJECT_TYPE_MAP[data.storeNeed] ?? [],
    timing: TIMING_MAP[data.projectTimeline] ?? undefined,
    notes: notesLines.join("\n") || undefined,
    xNote: data.mainChallenges.trim() || undefined,
    companions: namedCompanions.length ? namedCompanions : undefined,
    consentAccepted: true,
    consentTextVersion,
    submissionToken,
    honeypot: data.companyWebsite2 || ""
  };
}

export async function submitSurveyResponse(campaignSlug: string, team: string, data: SurveyData, submissionToken: string, consentTextVersion: string, companions: Companion[]) {
  const res = await fetch(`/api/public/campaigns/${campaignSlug}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSubmissionPayload(team, data, submissionToken, consentTextVersion, companions))
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Something went wrong — please try again.");
  }
  return body as { ok: true; submissionId: string; status: string };
}
