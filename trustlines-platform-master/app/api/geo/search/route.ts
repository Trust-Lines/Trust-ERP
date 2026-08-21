import { NextRequest, NextResponse } from 'next/server';
import { STATE_ABBR, US_STATES } from '@/lib/usStates';

const ABBR_TO_NAME = Object.fromEntries(US_STATES.map(s => [s.abbr, s.name]));

interface NominatimAddress {
  house_number?: string; road?: string;
  city?: string; town?: string; village?: string; hamlet?: string; municipality?: string;
  county?: string; state?: string; postcode?: string;
}
interface NominatimResult { place_id: number; lat: string; lon: string; display_name: string; address?: NominatimAddress }

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const stateParam = (req.nextUrl.searchParams.get('state') ?? '').trim();
  const stateName  = ABBR_TO_NAME[stateParam.toUpperCase()] ?? stateParam;
  const stateAbbrFilter = STATE_ABBR[stateName.toLowerCase()] ?? stateParam.toUpperCase();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const fullQ = stateName ? `${q}, ${stateName}` : q;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQ)}`
    + `&format=jsonv2&addressdetails=1&countrycodes=us&limit=8`;

  let data: NominatimResult[] = [];
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'TrustLines-Platform/1.0 (project location search)',
        'Accept-Language': 'en',
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    data = await res.json() as NominatimResult[];
  } catch {
    return NextResponse.json({ results: [] });
  }

  const results = data.map(r => {
    const a = r.address ?? {};
    const city  = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? '';
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const stateAbbr = a.state ? (STATE_ABBR[a.state.toLowerCase()] ?? a.state) : '';
    const locPart = [city, street].filter(Boolean).join(', ');
    const label = `${locPart}${locPart ? ', ' : ''}${stateAbbr}${a.postcode ? ' ' + a.postcode : ''}`.trim();
    return {
      id: r.place_id,
      label,
      display: r.display_name,
      street, city, county: a.county ?? '', state: a.state ?? '', stateAbbr,
      postcode: a.postcode ?? '',
    };
  }).filter(r => (r.city || r.street) && (!stateParam || r.stateAbbr === stateAbbrFilter));

  return NextResponse.json({ results });
}
