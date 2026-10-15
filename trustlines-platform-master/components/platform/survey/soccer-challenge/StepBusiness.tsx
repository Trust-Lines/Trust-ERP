"use client";

import type { SurveyData } from "./constants";
import { Field } from "./Field";

/** Step 3 — "Your business": brand name and store address. */
export function StepBusiness({ data, update }: { data: SurveyData; update: (name: string, value: string) => void }) {
  return (
              <>
                <span className="overline-tag">Business details</span>
                <h1 className="step-heading">Your business</h1>
                <p className="intro">Share the key details about your store — everything here is optional, you can skip ahead.</p>
                <div className="field-grid">
                  <Field label="Brand name" name="companyName" value={data.companyName} update={update} placeholder="Brand name" />
                  <Field label="Store address" name="companyAddress" value={data.companyAddress} update={update} type="textarea" placeholder="Street address, City, State, ZIP" wide />
                </div>
              </>
  );
}
