"use client";

import type { SurveyData } from "./constants";
import { Field } from "./Field";

/** Step 4 — "Store status": status, size, project type, timeline and notes. */
export function StepStoreStatus({ data, update }: { data: SurveyData; update: (name: string, value: string) => void }) {
  return (
              <>
                <span className="overline-tag">Project details</span>
                <h1 className="step-heading">Store status</h1>
                <p className="intro">Help us understand your project scope and upcoming timelines — all optional.</p>
                <div className="field-grid">
                  <Field label="Store status" name="storeStatus" value={data.storeStatus} update={update}>
                    <option value="">Select store status</option>
                    <option>New Store (Planning)</option>
                    <option>Existing Store (Operating)</option>
                  </Field>
                  <Field label="Store size" name="storeSize" value={data.storeSize} update={update}>
                    <option value="">Select square footage</option>
                    <option>Small (0 - 2,000 sqft)</option>
                    <option>Medium (2,000 - 5,000 sqft)</option>
                    <option>Large (5,000+ sqft)</option>
                  </Field>
                  <Field label="Project type" name="storeNeed" value={data.storeNeed} update={update} wide>
                    <option value="">Select project scope</option>
                    <option>I want to remodel my existing store</option>
                    <option>I have a new store coming up</option>
                    <option>Both - remodel and new store</option>
                    <option>I'm considering it</option>
                    <option>Not right now</option>
                  </Field>
                  <Field label="Project timeline" name="projectTimeline" value={data.projectTimeline} update={update}>
                    <option value="">Select target timeline</option>
                    <option>ASAP (Next 3 months)</option>
                    <option>3-6 Months</option>
                    <option>6-12 Months</option>
                    <option>Still Planning</option>
                  </Field>
                  {/* Notes' real home: the sticky note (every other page) is the same text, so it shows up here. */}
                  <Field label="Notes" name="mainChallenges" value={data.mainChallenges} update={update} type="textarea" placeholder="Anything else we should know?" wide />
                </div>
              </>
  );
}
