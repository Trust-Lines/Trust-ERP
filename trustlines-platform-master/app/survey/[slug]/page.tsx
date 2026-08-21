"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SoccerChallenge } from "@/components/platform/survey/SoccerChallenge";

interface CampaignInfo {
  slug: string;
  name: string;
  publicTitle: string | null;
  publicDescription: string | null;
  status: string;
  submissionOpen: boolean;
  consentTextVersion: string;
  surveyTemplate: string;
}

const centeredMessage: React.CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  textAlign: "center", padding: 24, fontFamily: "system-ui, sans-serif", color: "#0c1811",
};

export default function SurveyPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/campaigns/${slug}`)
      .then(async (res) => {
        if (!res.ok) { if (!cancelled) setNotFound(true); return; }
        const body = await res.json();
        if (!cancelled) setCampaign(body.campaign ?? null);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div style={centeredMessage}>Loading…</div>;
  if (notFound || !campaign) return <div style={centeredMessage}>This survey link isn&apos;t available.</div>;
  if (!campaign.submissionOpen) {
    return (
      <div style={centeredMessage}>
        {campaign.publicTitle || campaign.name} isn&apos;t open for submissions right now — please check back later.
      </div>
    );
  }

  if (campaign.surveyTemplate === 'soccer_challenge') {
    return <SoccerChallenge campaignSlug={campaign.slug} consentTextVersion={campaign.consentTextVersion} />;
  }

  return (
    <div style={centeredMessage}>
      {campaign.publicTitle || campaign.name} doesn&apos;t have a survey page set up yet.
    </div>
  );
}
