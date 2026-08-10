import { PwaRegister } from '@/components/PwaRegister';

export const metadata = {
  title: 'MenuFlow SuperAdmin',
  manifest: '/manifest-superadmin.json',
  icons: { icon: '/icons/superadmin/icon-192.png', apple: '/icons/superadmin/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MF Owner' },
};

export const viewport = {
  themeColor: '#f59e0b',
};

export default function SuperAdminLayout({ children }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
