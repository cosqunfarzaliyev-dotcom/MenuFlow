# MenuFlow — Supabase İnteqrasiyası və Quraşdırma Təlimatı

Bu sənəd MenuFlow layihəsində Supabase məlumat bazasının, autentifikasiyanın (Auth), Realtime (canlı yenilənmələr) və Storage (fayl yüklemeleri) funksiyalarının sıfırdan necə quraşdırılacağını Addım-Addım izah edir.

---

## 🚀 1. Supabase Layihəsinin Yaradılması

1. [Supabase Dashboard](https://supabase.com/dashboard) saytına daxil olun.
2. **"New Project"** düyməsini sıxın.
3. Layihə adını yazın (məsələn: `menuflow-db`), güclü Database şifrəsi təyin edin və regionu seçin.
4. Layihə yaradıldıqdan sonra **Project Settings -> API** bölməsinə keçin.

---

## 🔑 2. Ətraf Mühit Dəyişənlərinin (.env.local) Təyin Edilməsi

Layihənizin kök qovluğundakı `.env.local` faylına Supabase məlumatlarınızı əlavə edin:

```env
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_ANON_KEY"
```

> **Qeyd:** `.env.local` faylını dəyişdikdən sonra local serveri (`npm run dev`) yenidən başladın.

---

## 🗄️ 3. Məlumat Bazası Strukturunun (Database Schema) İcrası

Məlumat bazası cədvəllərini, RLS təhlükəsizlik qaydalarını, triqqerləri və Realtime funksiyasını aktivləşdirmək üçün 2 üsuldan birini seçə bilərsiniz:

### Ən Asan Üsul: Tək Kliklə Skript (Single Master Script)
1. Layihədəki [`supabase/full_schema.sql`](file:///c:/Users/Coshgun/OneDrive/Desktop/MenuFlow/supabase/full_schema.sql) faylının məzmununu kopyalayın.
2. Supabase Dashboard-da **SQL Editor** bölməsinə keçin.
3. Kopyalanan SQL skriptini yapışdırın və **Run** (İcra et) düyməsini sıxın.

### Alternativ Üsul: Migrasiyaları Sıra İlə İcra Etmək
Supabase SQL Editor-da `supabase/migrations/` qovluğundakı SQL fayllarını sıra ilə icra edin:
1. `0000_initial_schema.sql` (Əsas cədvəllər)
2. `0001_multi_tenant_saas.sql` (Çox-müştərili SaaS strukturu & Profiles)
3. `0002_security_hardening.sql` (Sifariş və Çağırış Rate-Limiting triqqerləri)
4. `0003_self_service_signup.sql` (Özünə-xidmət Qeydiyyat & Restoran yaradılması)
5. `0004_product_rating.sql` (Məhsul qiymətləndirmə sütunu)
6. `0005_super_admin_user_directory.sql` (Platforma istifadəçiləri siyahısı RPC)
7. `0006_admin_feature_pack.sql` (Bannerlər, Kampaniyalar, Endirimlər və Audit Log)
8. `0007_realtime_and_storage.sql` (Realtime yayınlama və Şəkil yükləmə qovluğu)

---

## 👑 4. Super Admin İstifadəçisinin Təyini

Platformanı tam idarə etmək (Super Admin paneli: `/superadmin`) üçün:

1. MenuFlow tətbiqində `/login` və ya `/signup` səhifəsindən e-poçt ünvanınızla qeydiyyatdan keçin.
2. Supabase SQL Editor-a daxil olub istifadəçinizə `super_admin` rolunu verin:

```sql
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'sizin-email@example.com';
```

3. İndi tətbiqdə daxil olduqda avtomatik olaraq **`/superadmin`** (Platforma İdarəetmə Paneli) səhifəsinə yönləndiriləcəksiniz.

---

## ⚡ 5. Supabase Realtime Aktivləşdirilməsi

Canlı sifarişlərin və ofisiant çağırışlarının real vaxt rejimində panellərdə görünməsi üçün Supabase Realtime yayımı istifadə olunur:

* Realtime avtomatik olaraq `full_schema.sql` və ya `0007_realtime_and_storage.sql` vasitəsilə aşağıdakı cədvəllər üçün aktivləşdirilir:
  * `orders`, `alerts`, `restaurant_tables`, `products`, `categories`, `banners`, `campaigns`, `discounts`
* Supabase Dashboard -> **Database -> Publications -> `supabase_realtime`** bölməsində həmin cədvəllərin seçildiyini yoxlaya bilərsiniz.

---

## 📦 6. Supabase Storage (Fayl Yükləmə) Siyasətləri

* Logo, menyu məhsul şəkilləri və banner şəkilləri üçün `menuflow` adında **Public** Storage bucket yaradılır.
* İctimaiyyət şəkilləri baxmaq (Select) hüququna, qeydiyyatdan keçmiş restoran administratorları holds (Insert/Update/Delete) hüququna malikdir.

---

## 🛠️ 7. Təhlükəsizlik və Ətraf Mühit Qoruması (Mock Data Fallback)

* Əgər `.env.local` daxilində Supabase URL və Key göstərilməyibsə, sistem dərhal sıradan çıxmır. `lib/supabase.js` daxilində hazırlanmış **Fallback Client** vasitəsilə tətbiq demo/mock rejimdə işləməyə davam edir.
* `.env.local` daxilində düzgün Supabase parametrləri qeyd olunduqda, sistem avtomatik olaraq canlı Supabase backend-inə keçid edir.

---

## 🔍 Yoxlama Və Test Etmə

1. `npm run dev` əmri ilə tətbiqi başladın.
2. QR menyuya daxil olub test sifarişi verin: məlumatların Supabase `orders` və `order_items` cədvəllərinə düşdüyünü təsdiqləyin.
3. İdarəetmə panelində sifarişlərin canlı yeniləndiyini yoxlayın.
