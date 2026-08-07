import { PwaRegister } from '@/components/PwaRegister';

export const metadata = {
  title: 'MenuFlow Admin',
  manifest: '/manifest-admin.json',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MF Admin' },
};

export const viewport = {
  themeColor: '#2563eb',
};

export default function AdminLayout({ children }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
