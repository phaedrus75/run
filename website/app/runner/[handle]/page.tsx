import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  return {
    title: `@${params.handle} — ZenRun`,
    description: `View ${params.handle}'s running journey on ZenRun.`,
    openGraph: {
      title: `@${params.handle} — ZenRun`,
      description: `View ${params.handle}'s running journey on ZenRun.`,
    },
  };
}

export default function RunnerProfilePage({ params }: { params: { handle: string } }) {
  return <ProfileClient handle={params.handle} />;
}
