// ---------------------------------------------------------------------------
// Platform announcements — SuperAdmin -> restoran sahibləri.
//
// İki auditoriya, bir cədvəl: SuperAdmin hər şeyi (qaralamalar daxil) görüb
// yazır, restoran admini isə yalnız dərc edilmiş və ona ünvanlanan sətirləri
// oxuya bilir. Bu ayrımı BU FAYL etmir — supabase/migrations/0041_
// announcements.sql-dəki iki RLS siyasəti edir. Buradakı fetchAnnouncements()
// və fetchAllAnnouncements() eyni sorğunu göndərir; fərqli nəticə qaytarmaları
// tamamilə server tərəfli filtrin nəticəsidir, client heç nə süzmür.
// ---------------------------------------------------------------------------
import { supabase, supabaseReady } from '@/lib/supabase';

const normalizeRow = (row) => (row ? { ...row, id: row.id?.toString() } : null);

// ---------------------------------------------------------------------------
// Hazır mesaj şablonları
//
// Qəsdən i18n lüğətlərində DEYİL: bunlar UI chrome deyil, göndərilən MƏZMUNUN
// başlanğıc nüsxəsidir — eyni ayrım lib/site-content/defaults.js ilə
// dictionaries/marketing.js arasında artıq mövcuddur. SuperAdmin şablonu
// seçir, mətn formaya düşür və göndərməzdən əvvəl sərbəst redaktə olunur, yəni
// bunlar qayda yox, sadəcə başlanğıc nöqtəsidir.
// ---------------------------------------------------------------------------
export const ANNOUNCEMENT_TEMPLATES = [
  {
    key: 'maintenance',
    level: 'warning',
    title: 'Planlaşdırılmış texniki işlər',
    body: 'Hörmətli tərəfdaş, sistemdə planlaşdırılmış texniki işlər aparılacaq. Bu müddət ərzində panelə giriş qısa müddətlik dayana bilər. QR menyunuz və sifariş qəbulu işləməyə davam edəcək. Anlayışınız üçün təşəkkür edirik.',
  },
  {
    key: 'feature',
    level: 'info',
    title: 'Yeni funksiya əlavə olundu',
    body: 'Panelinizə yeni funksiya əlavə etdik. Ətraflı məlumat üçün admin panelindəki müvafiq bölməyə baxa bilərsiniz. Suallarınız olarsa bizimlə əlaqə saxlayın.',
  },
  {
    key: 'billing',
    level: 'warning',
    title: 'Abunəlik xatırlatması',
    body: 'Abunəlik müddətinizin bitməsinə az qalıb. Xidmətin fasiləsiz davam etməsi üçün abunəliyinizi yeniləməyinizi xahiş edirik.',
  },
  {
    key: 'general',
    level: 'info',
    title: '',
    body: '',
  },
];

export const ANNOUNCEMENT_LEVELS = ['info', 'warning', 'critical'];

// ---------------------------------------------------------------------------
// Restoran tərəfi (admin paneli, zəng ikonu)
// ---------------------------------------------------------------------------

// RLS `announcements_tenant_read` yalnız dərc edilmiş + bu restorana ünvanlanan
// sətirləri buraxır, ona görə burada nə `is_published`, nə də hədəf filtri var:
// onları client-də təkrarlamaq təhlükəsizlik yaratmır, sadəcə eyni qaydanın iki
// yerdə saxlanmasına gətirib çıxarardı.
export const fetchAnnouncements = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false });
  if (error) {
    console.error('fetchAnnouncements error:', error);
    return [];
  }
  return (data || []).map(normalizeRow);
};

// announcement_reads RLS-i onsuz da profile_id = auth.uid() ilə məhdudlaşdırır,
// yəni bu sorğu heç vaxt başqasının oxunma qeydini qaytara bilməz.
export const fetchMyReadIds = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase.from('announcement_reads').select('announcement_id');
  if (error) {
    console.error('fetchMyReadIds error:', error);
    return [];
  }
  return (data || []).map((row) => row.announcement_id?.toString());
};

// Kompozit PK (announcement_id, profile_id) sayəsində təkrar çağırış xəta
// vermir — ignoreDuplicates ilə mövcud sətirlər sadəcə ötürülür. Bu, panelin
// hər açılışında çağırıla bilməsini təhlükəsiz edir.
export const markAnnouncementsRead = async (announcementIds, profileId) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  if (!profileId || !announcementIds?.length) return { error: null };
  const { error } = await supabase
    .from('announcement_reads')
    .upsert(
      announcementIds.map((id) => ({ announcement_id: id, profile_id: profileId })),
      { onConflict: 'announcement_id,profile_id', ignoreDuplicates: true },
    );
  if (error) console.error('markAnnouncementsRead error:', error);
  return { error };
};

// ---------------------------------------------------------------------------
// SuperAdmin tərəfi
// ---------------------------------------------------------------------------
export const fetchAllAnnouncements = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchAllAnnouncements error:', error);
    return [];
  }
  return (data || []).map(normalizeRow);
};

// `targetRestaurantIds`: boş massiv və ya null -> BÜTÜN restoranlar (sütun null
// qalır). Boş massivi null-a çevirmək vacibdir: `x = any('{}')` heç vaxt doğru
// olmur, yəni boş massiv saxlansaydı elan HEÇ KİMƏ görünməzdi.
const toRow = ({ title, body, level, targetRestaurantIds, isPublished }) => ({
  title: title?.trim() || '',
  body: body?.trim() || '',
  level: ANNOUNCEMENT_LEVELS.includes(level) ? level : 'info',
  target_restaurant_ids: targetRestaurantIds?.length ? targetRestaurantIds : null,
  is_published: Boolean(isPublished),
  published_at: isPublished ? new Date().toISOString() : null,
});

export const createAnnouncement = async (announcement, createdBy) => {
  if (!supabaseReady) return { announcement: null, error: new Error('Supabase not ready') };
  const payload = { ...toRow(announcement), created_by: createdBy || null };
  const { data, error } = await supabase.from('announcements').insert(payload).select('*').single();
  if (error) {
    console.error('createAnnouncement error:', error);
    return { announcement: null, error };
  }
  return { announcement: normalizeRow(data), error: null };
};

export const updateAnnouncement = async (id, announcement) => {
  if (!supabaseReady) return { announcement: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase
    .from('announcements')
    .update(toRow(announcement))
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error('updateAnnouncement error:', error);
    return { announcement: null, error };
  }
  return { announcement: normalizeRow(data), error: null };
};

export const deleteAnnouncement = async (id) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) console.error('deleteAnnouncement error:', error);
  return { error };
};
