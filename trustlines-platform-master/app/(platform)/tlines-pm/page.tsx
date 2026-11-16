import { BranchBoardPage } from '@/components/platform/dashboard/BranchBoardPage';

// T-Lines PM → Board: the branch board. Data, visibility and filters live in BranchBoardPage,
// shared with /dashboard (same board in the Figma "General Manager" layout).
export default async function TlinesPmBoardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <BranchBoardPage viewParam={view} layout="board" />;
}
