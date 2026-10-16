export type SurveyData = Record<string, string>;

export const steps = ["Pick your team", "Meet the player", "Your business", "Store status", "Final review", "Victory card"];
export const POSITIONS = ["Owner", "Manager", "Partner", "Employee", "Other"];
export const CONTACT_METHODS =["Phone Call", "WhatsApp Text Message", "Email"];
export const teams = ["Convenience Stores", "Grocery Stores", "Truck Stop", "Other"];
export const initialData: SurveyData = {
  representative: "",
  fullName: "",
  position: "",
  phone: "",
  email: "",
  contactPreference: "",
  companyName: "",
  companyAddress: "",
  storeStatus: "",
  storeSize: "",
  storeNeed: "",
  mainChallenges: "",
  projectTimeline: "",
  companyWebsite2: ""
};

// Required: which T-Lines representative is entering the survey (becomes the profile's "Created by"),
// the person's name, a valid email and the store address (location). Everything else
// (and the team pick) can be skipped.
export const requiredByStep = [[], ["representative", "fullName", "email"], ["companyAddress"], []];
export const REQUIRED_FIELDS = new Set(requiredByStep.flat());
export const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export const TIMING_MAP: Record<string, string> = {
  "ASAP (Next 3 months)": "0_3_months",
  "3-6 Months": "3_6_months",
  "6-12 Months": "6_12_months",
  "Still Planning": "12_plus_months"
};
export const PROJECT_TYPE_MAP: Record<string, string[]> = {
  "I want to remodel my existing store": ["small_remodel"],
  "I have a new store coming up": ["new_construction"],
  "Both - remodel and new store": ["small_remodel", "new_construction"]
};

export const newSubmissionToken = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export type Companion = { name: string; title: string; phone: string; email: string };
export const MAX_COMPANIONS = 5;
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 200 * 1024 * 1024; // matches the server limit
export const ATTACHMENT_SINGLE_MAX_BYTES = 4_000_000;
export const ATTACHMENT_CHUNK_BYTES = 4_000_000;
export const NOTE_MAX = 2000; // the server keeps at most this much of the X-note
