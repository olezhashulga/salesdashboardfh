'use client';

import dynamic from 'next/dynamic';

const SalesDashboard = dynamic(() => import('@/components/SalesDashboard'), {
  ssr: false
});

export default function Home() {
  return (
    <main>
      <SalesDashboard />
    </main>
  );
}