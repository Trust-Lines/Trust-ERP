# PHASE 00 — MARKETING, LEAD CLOUD & OPPORTUNITY ORIGINATION

> Bu faz iş akışının gerçek başlangıcıdır.
>
> Ana zincir:
>
> `Marketing & PR → Lead Cloud → Potential / Nurture → Opportunity → Sales Handoff → Closed Deal`
>
> Bu faz mevcut Sales, Customer, Project, Design, Phase 10 ve Phase 11 yapılarını bozmaz. Yeni başlangıç katmanını additive olarak ekler ve mevcut `lead_intake` yapısıyla uyumluluk kurar.

## 1. Temel iş modeli

### Lead / Prospect

Lead, hakkında veri toplanan kişi, marka veya organizasyondur. Lead doğrudan Opportunity değildir.

Bir Lead’in:

- hiç Opportunity’si olmayabilir,
- bir Opportunity’si olabilir,
- aynı anda birden fazla Opportunity’si olabilir.

Teknik isim `prospect`, UI etiketi `Lead` olabilir.

### Potential

Potential, Lead’in bugün aktif işi olmayan fakat gelecekte Opportunity’ye dönüşebilecek ihtiyacıdır.

Örnek:

- Şirketin 15 lokasyonu var fakat remodel planı 8 ay sonra.
- Yeni mağaza açmayı düşünüyor ama bütçe henüz net değil.
- “3 ay sonra tekrar arayın” dedi.
- Mevcut mağaza eski fakat yenileme tarihi ileride.

Potential alanları:

```text
potential_type
estimated_timing
target_contact_date
estimated_location_count
confidence
nurture_status
assigned_to
notes
```

### Opportunity

Opportunity tanımlanabilir gerçek ticari ihtiyaçtır.

Örnek sinyaller:

- mevcut proje var,
- proje/lokasyon belli,
- deadline veya hedef tarih var,
- proje tipi belli,
- karar verici ile iletişim kurulmuş,
- toplantı veya teklif isteği var,
- layout/drawing mevcut.

Bir Lead altında birden fazla Opportunity bulunabilir.

Örnek:

```text
Lead: ABC Jewelry

Opportunity 1:
- Manhattan Full Remodel
- Deadline: October

Opportunity 2:
- Brooklyn New Construction
- Deadline: Next Year
```

## 2. Sahiplik

### Marketing & PR

Marketing & PR şu aşamalardan sorumludur:

```text
Captured
Enrichment
Potential
Nurture
Opportunity Candidate
Qualified for Sales
```

Görevleri:

- fuar, event, web, referral ve kampanya verisi toplamak,
- duplicate kontrolü yapmak,
- şirket/contact/lokasyon bilgisini zenginleştirmek,
- potansiyel ihtiyaçları kaydetmek,
- takip tarihi belirlemek,
- Opportunity adayı oluşturmak,
- Sales handoff hazırlamak.

### Sales

Sales şu aşamalardan itibaren ana sahibidir:

```text
Sales Accepted
Discovery
Sales Design
Proposal
Negotiation
Closed Won
Closed Lost
```

Marketing attribution ve geçmiş kaybolmaz.

## 3. Veri modeli

> Önce mevcut `lead_intake`, `lead_tasks`, `lead_activity`, `lead_watchers`, `customers`, `customer_contacts`, meeting/follow-up ve Sales Design yapıları audit edilmelidir.
>
> Mevcut tablolar destructively rename edilmez.

### `prospects`

```text
id
organization_name
brand_name
industry
website
main_email
main_phone
company_size
location_count
status
source_id
campaign_id
event_id
owner_id
assigned_marketing_user_id
customer_id
is_archived
deleted_at
created_at
updated_at
```

Status:

```text
captured
enrichment
potential
nurture
opportunity_candidate
qualified_for_sales
converted
disqualified
archived
```

### `prospect_contacts`

```text
id
prospect_id
name
title
role_type
email
phone
linkedin_url
is_decision_maker
is_primary
contact_consent
notes
created_by
created_at
updated_at
```

### `prospect_locations`

Bir Lead’in birden fazla lokasyonu olabilir.

```text
id
prospect_id
location_name
address_line_1
address_line_2
city
state
postal_code
country
location_type
is_active
store_status
estimated_remodel_date
notes
created_at
updated_at
```

### `prospect_potentials`

```text
id
prospect_id
location_id
title
potential_type
status
estimated_start_date
target_contact_date
estimated_quantity
estimated_value
currency
confidence
assigned_to
last_contact_at
next_contact_at
converted_opportunity_id
notes
created_at
updated_at
```

Status:

```text
identified
nurture
waiting_timing
contact_due
converted
lost
cancelled
```

### `opportunities`

```text
id
prospect_id
customer_id
primary_contact_id
title
description
opportunity_type
project_type
stage
source_id
campaign_id
event_id
marketing_owner_id
sales_owner_id
region_id
service_line_id
estimated_location_count
estimated_value
currency
probability
expected_close_date
deadline
urgency
budget_status
decision_maker_status
next_action
next_action_date
sales_handoff_at
sales_accepted_at
closed_at
closed_reason
created_by
created_at
updated_at
```

Stage:

```text
new
marketing_qualification
qualified_for_sales
sales_handoff
sales_accepted
discovery
sales_design
proposal
negotiation
closed_won
closed_lost
on_hold
```

Opportunity type:

```text
new_construction
full_remodel
small_remodel
repair
upgrade
items_only
design_only
multi_location_rollout
unknown
```

### `opportunity_locations`

Bir Opportunity bir veya daha fazla lokasyonu kapsayabilir.

```text
opportunity_id
prospect_location_id
scope_summary
estimated_start_date
deadline
priority
```

### Marketing attribution

```text
marketing_sources
marketing_campaigns
marketing_events
```

Source örnekleri:

```text
trade_fair
website
instagram
linkedin
referral
cold_outreach
email_campaign
walk_in
partner
existing_customer
other
```

## 4. Fuar / tablet web girişi

Web uygulamasında responsive kiosk/intake ekranı:

```text
/events/[eventId]/intake
```

Bu mobil uygulama değildir; tablet browser üzerinden çalışır.

### Sorular

#### Şirket

- Company / Brand name
- Industry
- Website
- Kaç lokasyon var?
- Birden fazla adres var mı?
- Gelecek lokasyon planı var mı?

#### Contact

- Name
- Job title
- Email
- Phone
- Decision maker mı?
- Preferred contact method

#### Proje ihtiyacı

- Şu anda aktif proje var mı?
- Kaç proje/lokasyon?
- New construction mı remodel mı?
- Full remodel, small remodel, repair, update, items only veya design only mı?
- Deadline nedir?
- Başlangıç tarihi nedir?
- Budget range nedir?
- Layout/drawing var mı?
- Site hazır mı?
- Hangi type’lar gerekli?

```text
millwork
shelving
ceiling
image
furniture
decoration
graphic
shop_drawing
other
```

#### Timing

```text
immediate
0–3 months
3–6 months
6–12 months
12+ months
no current project
```

### Autosave

Form:

- submission session açar,
- her cevapta autosave yapar,
- yarım kalırsa draft saklar,
- submit sırasında duplicate suggestion üretir,
- Prospect/Contact/Location kayıtlarını oluşturur veya mevcut kayda bağlar,
- classification engine çalıştırır,
- audit/activity yazar.

Dinamik form tabloları:

```text
intake_forms
intake_form_fields
intake_submissions
intake_submission_answers
```

## 5. Classification Engine

Sistem ilk sınıflandırma önerisi üretir fakat kullanıcı override edebilir. Kurallar açıklanabilir ve ayarlanabilir olmalıdır.

### Opportunity Candidate

Aşağıdaki sinyallerden biri veya birkaçı varsa:

```text
current_project = true
deadline exists
expected_start_date within configured horizon
project_type known
location/project count > 0
explicit interest = true
meeting requested = true
layout/drawing available = true
```

### Potential

```text
no active project
but location_count > 0
or future expansion exists
or future remodel date exists
or “contact later” requested
```

### Lead only

```text
contact captured
no current project
no timing
no defined need
insufficient information
```

### Classification sonucu

```text
classification
classification_reason[]
confidence
recommended_next_action
recommended_follow_up_date
```

Örnek:

```text
Classification: Potential
Reasons:
- 8 active locations
- No active project
- Remodel expected next year

Recommended action:
Contact 90 days before the expected remodel window.
```

## 6. Nurture ve hatırlatma

Marketing ekranı:

```text
Due today
Due this week
Upcoming
Overdue
No follow-up date
High-value potential
Multi-location potential
```

`target_contact_date` yaklaşınca:

- My Day görevi,
- in-app notification,
- gerekiyorsa email,
- timeline event,
- günde birden fazla tekrar etmeyen idempotent reminder.

Potential → Opportunity dönüşümünde:

- Prospect korunur,
- Potential `converted` olur,
- Opportunity açılır,
- Contact/Location bağlanır,
- Marketing attribution korunur,
- Sales handoff checklist açılır.

## 7. Sales handoff

Minimum checklist:

```text
Company identified
Primary contact identified
Contact information valid
Need/project summary entered
Location information entered
Project type entered or unknown selected
Timing entered
Next action entered
Source/campaign/event linked
Duplicate check completed
```

Akış:

```text
Qualified for Sales
→ Select Sales owner
→ Create handoff
→ Notify Sales
→ Sales accepts / returns / rejects
```

Sales kabul ettiğinde Opportunity Sales Workspace’e geçer.

## 8. Closed Won dönüşümü

Opportunity `closed_won` olduğunda idempotent şekilde:

1. Mevcut Customer varsa bağla.
2. Yoksa Prospect’ten Customer oluştur.
3. Prospect Contacts → Customer Contacts bağla/kopyala.
4. Prospect Location → Customer Address / Project Site bağla.
5. Tek Project ID oluştur veya draft project’i aktive et.
6. Approved Sales Design pointer’larını projeye bağla.
7. PM Handover başlat.
8. Marketing source/campaign/event attribution’ını koru.

Aynı Opportunity iki kez kapatılırsa ikinci Customer veya Project oluşmamalıdır.

## 9. Roller

### `marketing_pr`

- Prospect/Contact/Location oluşturur ve düzenler.
- Potential oluşturur.
- Intake form kullanır.
- Follow-up yapar.
- Opportunity candidate oluşturur.
- Sales handoff yapar.
- Closed Won yapamaz.
- PF/vendor/margin göremez.

### `marketing_manager`

- Tüm Marketing kayıtlarını görür.
- Campaign/Event/Form yönetir.
- Owner atar.
- Classification override eder.
- Sales handoff kalitesini izler.
- Marketing raporlarını görür.
- PF/vendor/margin göremez.

### Sales

- Kendisine handoff edilen Opportunity’leri görür.
- Accept/Return/Reject yapar.
- Discovery, Sales Design, Proposal ve Negotiation yönetir.
- Closed Won/Lost yapar.
- Marketing attribution’ını silemez.

## 10. Workspace’ler

### Marketing Dashboard

- Leads captured
- New prospects
- Potentials
- Opportunities created
- Sales handoffs
- Conversion rate
- Source/Campaign/Event performance
- Follow-ups due
- Multi-location leads
- High-value potentials

### Lead Cloud

Kolonlar:

```text
Lead
Primary contact
Industry
Locations
Source
Owner
Classification
Potential count
Opportunity count
Next contact
Last activity
```

### Prospect 360

Sekmeler:

```text
Overview
Contacts
Locations
Potentials
Opportunities
Activities
Files
Campaign attribution
```

### Opportunity Workspace

```text
Marketing Qualification
Sales Handoff
Sales Accepted
Discovery
Sales Design
Proposal
Negotiation
Closed Won/Lost
```

## 11. API taslağı

```text
GET    /api/prospects
POST   /api/prospects
GET    /api/prospects/[id]
PATCH  /api/prospects/[id]
POST   /api/prospects/[id]/classify

GET    /api/potentials
POST   /api/prospects/[id]/potentials
PATCH  /api/potentials/[id]
POST   /api/potentials/[id]/convert

GET    /api/opportunities
POST   /api/opportunities
GET    /api/opportunities/[id]
PATCH  /api/opportunities/[id]
POST   /api/opportunities/[id]/handoff
POST   /api/opportunities/[id]/accept
POST   /api/opportunities/[id]/return
POST   /api/opportunities/[id]/close-won
POST   /api/opportunities/[id]/close-lost

GET    /api/events/[eventId]/intake-form
POST   /api/events/[eventId]/submissions
PATCH  /api/events/[eventId]/submissions/[submissionId]
POST   /api/events/[eventId]/submissions/[submissionId]/submit
```

## 12. Teknik kurallar
 
- Her yeni tablo RLS taşır.
- Service-role route’lar explicit authorization kullanır.
- Cross-record sorgular indexed + limited olur.
- Duplicate kontrolü normalized organization name + email + phone + website domain üzerinden suggestion üretir.
- Otomatik merge yapılmaz.
- Her conversion idempotent olur.
- Audit log zorunludur.
- Existing `lead_intake` silinmez.
- Gerekirse compatibility alanları eklenir:

```text
prospect_id
opportunity_id
intake_submission_id
```

- Eski lead’ler için kontrollü backfill planı hazırlanır.
- Classification eşikleri config tablosundan veya merkezi ayardan okunur; magic number kullanılmaz.

## 13. Uygulama sırası

### 00.0 Audit

- [ ] Existing `lead_intake`
- [ ] Lead status ve deliver akışı
- [ ] Customer linking
- [ ] Sales Design
- [ ] Meetings/follow-ups/tasks
- [ ] Duplicate logic
- [ ] Source/campaign alanları
- [ ] Permissions/RLS
- [ ] Live DB migration durumu

### 00.1 Compatibility Map

- [ ] Lead/Prospect
- [ ] Potential
- [ ] Opportunity
- [ ] Customer
- [ ] Project
- [ ] No destructive rename

### 00.2 Marketing Roles

- [ ] `marketing_pr`
- [ ] `marketing_manager`
- [ ] permissions
- [ ] navigation
- [ ] My Day
- [ ] tests

### 00.3 Prospect Core

- [ ] prospects
- [ ] contacts
- [ ] locations
- [ ] indexes
- [ ] RLS
- [ ] types/API/audit

### 00.4 Potentials & Nurture

- [ ] potentials
- [ ] target contact dates
- [ ] reminders
- [ ] My Day
- [ ] convert to Opportunity

### 00.5 Opportunity Core

- [ ] opportunities
- [ ] locations
- [ ] stages
- [ ] pipeline
- [ ] handoff
- [ ] accept/return

### 00.6 Sources/Campaigns/Events

- [ ] attribution
- [ ] event records
- [ ] reporting

### 00.7 Event Intake

- [ ] dynamic forms
- [ ] responsive tablet UI
- [ ] autosave
- [ ] draft recovery
- [ ] duplicate suggestion
- [ ] classification

### 00.8 Classification Engine

- [ ] explainable rules
- [ ] configurable thresholds
- [ ] manual override
- [ ] unit tests

### 00.9 Lead Cloud & Prospect 360

- [ ] Lead Cloud
- [ ] filters
- [ ] Prospect 360
- [ ] activities

### 00.10 Closed Won Conversion

- [ ] Prospect → Customer
- [ ] Contacts → Customer Contacts
- [ ] Location → Project Site
- [ ] Opportunity → single Project ID
- [ ] PM Handover
- [ ] idempotency tests

## 14. Claude başlangıç komutu

```text
Read CLAUDE.md and all required documents in its source hierarchy.

Then read PHASE-00-MARKETING-LEAD-OPPORTUNITY-ORIGINATION.md completely.

Critical business model:
- A Lead/Prospect is NOT an Opportunity.
- One Prospect may have zero, one or many Opportunities.
- A Potential is a future possibility, not an active Opportunity.
- Marketing owns capture, enrichment, nurture and qualification.
- Sales owns accepted Opportunities through Closed Won/Lost.
- Closed Won links/converts Prospect data to Customer and creates or activates one Project ID.

Start with Phase 00.0 Audit.
Do not create duplicate tables before auditing lead_intake and the existing Sales CRM.
Do not destructively rename existing tables.
Produce a compatibility map first.
```

## 15. Done definition

- Lead, Potential, Opportunity, Customer ve Project ayrımı nettir.
- Bir Prospect sıfır/bir/çok Opportunity taşıyabilir.
- Fuar/tablet responsive intake çalışır.
- Autosave ve draft recovery çalışır.
- Duplicate suggestion vardır.
- Classification explainable ve override edilebilirdir.
- Potential reminder My Day’e düşer.
- Marketing → Sales handoff accept/return çalışır.
- Closed Won idempotent Customer + Project bağlantısı kurar.
- Marketing attribution korunur.
- Permission, typecheck, build ve ilgili testler geçer.
