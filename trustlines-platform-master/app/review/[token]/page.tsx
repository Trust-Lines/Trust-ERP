import { ReviewClient } from '@/components/review/ReviewClient';

export const metadata = { title: 'Review — Trust-Lines' };

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ReviewClient token={token} />;
}
