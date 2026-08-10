import { PwaRegister } from '@/components/PwaRegister';

export const metadata = {
  title: 'MenuFlow Ofisiant',
  manifest: '/manifest-staff.json',
  icons: { icon: '/icons/staff/icon-192.png', apple: '/icons/staff/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MF Staff' },
};

export const viewport = {
  themeColor: '#059669',
};

export default function StaffLayout({ children }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
