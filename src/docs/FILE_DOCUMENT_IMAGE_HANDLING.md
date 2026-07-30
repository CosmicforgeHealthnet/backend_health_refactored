# How File, Document & Image Handling Currently Works

This document explains, in plain terms, how uploaded files (images, PDFs, verification
documents, logos, product photos, etc.) move through the backend today: where they're
stored, how they're tracked in the database, and how they're served back out.

Stack: Node.js/Express + TypeORM (PostgreSQL). Uploads are parsed with `multer`.

---

## 1. The short version

- Files are **not** stored in the cloud (no S3/Cloudinary/Firebase is actually wired up,
  despite some leftover AWS config). Everything is stored **on local disk**, in a single
  flat folder: `uploads/images/`.
- Every file — whether it's a profile photo, a pharmacy license PDF, or a product image —
  gets renamed to a random UUID and dropped into that one folder. There's no per-type or
  per-date subfolder structure in current use.
- Metadata about each file (original name, who uploaded it, file type, hash, etc.) is
  recorded in the database, separately from the file itself.
- Files are served back to the app either through the database-aware API
  (`/api/documents/images/:id`) or directly by Nginx/Express as static files
  (`/images/:filename`).
- There are three separate, only loosely-connected systems that all do "file handling" in
  their own way (see section 3) — this grew organically feature-by-feature rather than
  being one unified design.

---

## 2. Lifecycle of a typical upload (e.g. a pharmacy verification document)

1. **Client sends the file** — a `multipart/form-data` POST request with the user's login
   token attached.
2. **Login is checked** before anything else happens.
3. **`multer` reads the file into memory** (not to disk yet) and rejects it up front if
   it's the wrong file type or too large.
4. **The file is processed**: its size/extension is checked again, a fingerprint (SHA-256
   hash) is calculated, it's given a new random UUID filename, and it's written to
   `uploads/images/<uuid>.<extension>`. PDFs may additionally be encrypted at rest.
5. **A "folder" record is created in the database** (not a real disk folder — a database
   row that groups related files together, e.g. all of one pharmacy's verification docs).
6. **A file record is saved in the database**, linking the physical file to that folder,
   to the uploader, and storing metadata (original filename, hash, type, etc.).
7. **The relevant feature takes over** — e.g. the pharmacy service creates a
   "PharmacyDocument" record marking it as a license/ID/etc. and flips the pharmacy's
   status to "under review".
8. **(Doctor documents only)** the file is queued for OCR (text extraction) so the system
   can auto-read details like license numbers.
9. **Later retrieval**: the client is given a URL like
   `https://.../api/documents/images/<fileId>`. Visiting that URL looks the file up in the
   database, reads it off disk, and streams it back.

---

## 3. The three parallel systems

The codebase has grown to have three overlapping approaches to "files," built at
different times for different features:

### A. Generic Document System (`src/features/documents/`)
The most fully-built system. Has proper concepts of **Folders** (grouped by type: 
verification, medical records, prescriptions, lab results, profile, pharmacy, etc.),
**Files** (with hashes, encryption, security levels), and **Access Logs** (an audit trail
of who viewed/downloaded/uploaded/deleted what). This is the system most other features
plug into.

### B. Doctor Verification Documents
Doctor license/ID verification has its **own separate** file-tracking table
(`VerificationDocument`) that duplicates a lot of what the generic system does, but adds
OCR results and AI fraud-detection fields. It bypasses the generic Folder/File system
entirely. National ID (NIN) verification itself doesn't involve a file at all — it's a
live lookup against a third-party ID verification API.

### C. Pharmacy / Vendor / Product uploads
Pharmacy documents, pharmacy/vendor logos, and product photos **do** use the generic
Document system underneath, but each has its own small "linking" table on top (e.g.
`PharmacyDocument` links a generic file to a pharmacy and a document type like
"pharmacy_license" or "government_id").

**Two things that don't use file upload at all**, worth knowing:
- **Prescriptions** are stored as structured data (medication name, dosage, etc.) typed
  in by the doctor — not a scanned/photographed document.
- **Lab results** are submitted as structured form data, not an uploaded PDF/image.

---

## 4. Where things are stored on disk

```
uploads/
└── images/            ← every current upload lands here, flat, no subfolders
    ├── <uuid>.jpg
    ├── <uuid>.png
    └── <uuid>.pdf
```

In production this lives at `/app/uploads` inside the Docker container, mounted so both
the app and the Nginx web server can read it. There's an older, now-unused folder
structure (`uploads/verification-documents/2025/06/09/...`) from a previous version of
the code that organized files by date — current code no longer writes there.

---

## 5. Cloud storage: planned, not implemented

The project has AWS SDK and Cloudinary-style pieces in its dependencies, and a database
table (`File`) whose comments describe a "cloud provider file identifier" — but none of
this is actually connected. The AWS SDK that *is* used is for **Textract**, an OCR
(text-reading) service, not for storing files in S3. All real storage today is the local
disk folder described above. If the app were to move to real cloud storage (recommended
for scaling past a single server, and for reliability), this is the piece that would need
building out.

---

## 6. Validation & security notes

- Allowed file types: JPEG, PNG, GIF, TIFF, PDF, Word documents (`.doc`/`.docx`).
- Max file size: 10MB by default (an admin setting can raise/lower this without a code
  deploy).
- Filenames are randomized (UUID) so uploaded files can't overwrite each other or leak
  the original filename.
- A basic check blocks obviously dangerous file extensions (`.exe`, `.bat`, `.php`, etc.)
  based on the filename — this is a simple filename check, not a deep scan of file
  contents.
- Some documents (PDFs) are encrypted at rest; images currently are not.
- Some retrieval routes require login, others (public image URLs) intentionally don't,
  since profile photos/logos need to display without a login check on every page load.

---

## 7. Full database schema for files/documents/images

Every table below is a real TypeORM entity in the codebase. Column names shown are the
actual database column names (snake_case where the code maps them explicitly).

### `document_files` — the core file record (generic system)
One row per physical uploaded file, whatever type of document it is.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `original_file_name` | varchar | name the user's file had before upload |
| `stored_file_name` | varchar | the UUID name it was saved under on disk |
| `file_path` | varchar | relative path under `uploads/`, e.g. `images/<uuid>.png` |
| `file_size` | bigint | bytes |
| `mime_type` | varchar | e.g. `image/png`, `application/pdf` |
| `file_hash` | varchar | SHA-256 fingerprint of the file contents |
| `encryption_key` | varchar, nullable | present if the file is encrypted at rest |
| `document_type` | varchar | e.g. `medical_license`, `government_id`, `profile_picture` |
| `status` | enum | `uploaded`, `processing`, `ready`, `corrupted`, `deleted` |
| `security_level` | enum | `public`, `private`, `confidential`, `restricted` |
| `folder_id` | uuid (FK → `document_folders.id`) | which folder this file belongs to |
| `uploader_id` | uuid (FK → `users.id`) | who uploaded it |
| `download_count` | int | |
| `last_accessed_at` | timestamp, nullable | |
| `thumbnail_path` | varchar, nullable | not currently populated (see rough edges) |
| `is_encrypted` | boolean | |
| `checksum` | varchar, nullable | |
| `version` | int | |
| `created_at` / `updated_at` | timestamp | |
| **FHIR-related** (health-data-interchange standard fields, mostly unused so far) | | `fhir_resource_type`, `patient_identifier`, `fhir_security_labels` (jsonb), `consent_directives` (jsonb), `fhir_version`, `fhir_sensitivity_level`, `fhir_resource_id`, `purpose_of_use` (jsonb) |

Indexes on: folder, uploader, file hash, (document type + status), created date, plus a
few FHIR-specific ones.

### `document_folders` — logical grouping of files (a DB concept, not a real disk folder)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | varchar | |
| `description` | text, nullable | |
| `folder_type` | enum | `verification`, `medical_records`, `prescription`, `lab_results`, `profile`, `images`, `pharmacy`, `pharmacy_verification`, `other` |
| `status` | enum | `active`, `archived`, `deleted` |
| `owner_id` | uuid (FK → `users.id`) | |
| `encryption_key` | varchar, nullable | |
| `folder_hash` | varchar, nullable | combined hash of the folder's contents |
| `metadata` | jsonb, nullable | |
| `tags` | simple array, nullable | |
| `is_public` | boolean | |
| `expires_at` | timestamp, nullable | |
| `created_at` / `updated_at` | timestamp | |

Relations: one folder → many `document_files`; one folder → many `folder_access_logs`.

### `file_access_logs` / `folder_access_logs` — audit trail

Same shape for both:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `access_type` | enum | `view`, `download`, `upload`, `delete`, `share`, `modify` |
| `file_id` / `folder_id` | uuid (FK) | which file/folder was touched |
| `user_id` | uuid (FK → `users.id`) | who did it |
| `ip_address` | varchar, nullable | |
| `user_agent` | text, nullable | |
| `download_duration` | int, nullable | *(files only)* |
| `accessed_at` | timestamp | |
| `metadata` | jsonb, nullable | |

### `verification_documents` — doctor license/ID verification (separate system)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `verificationRequestId` | uuid (FK → `verification_requests.id`) | |
| `documentType` | enum | `medical_license`, `medical_degree`, `board_certification`, `postgraduate_certificate`, `government_id`, `proof_of_practice`, `good_standing_certificate`, `other` |
| `originalFileName` / `storedFileName` | varchar | |
| `filePath` | varchar | comment in code says "S3/storage path" but it's actually local disk today |
| `fileSize` | integer (bytes) | |
| `mimeType` | varchar | |
| `fileHash` | varchar | SHA-256 |
| `encryptionKey` | varchar, nullable | |
| `digitalSignature` | text, nullable | |
| `status` | enum | `uploaded`, `processing`, `verified`, `rejected`, `expired` |
| `ocrText` | text, nullable | raw text read off the document |
| `extractedData` | jsonb, nullable | structured fields OCR pulled out |
| `aiAnalysisResult` | jsonb, nullable | fraud-detection output |
| `ocrConfidence` | float, nullable | 0–1 |
| `verifiedBy` | varchar, nullable | e.g. "API", a reviewer, "AI" |
| `verifiedAt` | timestamp, nullable | |
| `rejectionReason` | text, nullable | |
| `uploadedBy` | uuid (FK → `users.id`) | usually the doctor |
| `lastAccessedAt` | timestamp, nullable | |
| `accessCount` | integer | |
| `uploadedAt` / `createdAt` / `updatedAt` | timestamp | |

### `pharmacy_documents` — links a generic file to a pharmacy's verification

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `pharmacyId` | uuid (FK → `pharmacy_profiles.id`) | |
| `documentFileId` | uuid (FK → `document_files.id`, one-to-one) | the actual file lives in the generic system; this row just classifies it |
| `documentType` | enum | `pharmacy_license`, `government_id`, `business_registration`, `tax_certificate`, `other` |
| `documentName` | varchar | |
| `isVerified` | boolean | |
| `verificationNotes` | text, nullable | |
| `verifiedBy` | uuid (FK → `users.id`), nullable | |
| `verifiedAt` | timestamp, nullable | |
| `submissionStatus` | enum | `pending`, `submitted`, `under_review`, `approved`, `rejected`, `resubmission_required` |
| `createdAt` / `updatedAt` | timestamp | |

### `vendor_documents` — vendor's own verification docs (does *not* go through the generic file system)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `vendorId` | uuid (FK → `vendor_profiles.id`) | |
| `documentType` | enum | `government_id`, `business_registration` |
| `documentUrl` | varchar | the file's URL directly, no separate file table |
| `fileName` / `mimeType` | varchar, nullable | |
| `verificationStatus` | enum | `pending`, `approved`, `rejected` |
| `createdAt` / `updatedAt` | timestamp | |

### `files` — legacy/unused generic table (client-supplied URLs, "cloud" in name only)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `upload_by` | uuid (FK → `users.id`) | |
| `file_url` | varchar(1024) | supplied directly by the client — nothing in the app actually writes to a cloud provider |
| `file_name` | varchar(255) | |
| `folder_name` | varchar(255) | |
| `file_id` | varchar(255) | comment says "Cloud provider file identifier" — aspirational, unused |
| `created_at` | timestamp | |

### Image/URL fields living directly on other tables (no separate file row)

| Table | Column | Type | Notes |
|---|---|---|---|
| `users` | `profileImageUrl` | varchar, nullable | patient/doctor/general profile photo |
| `users` | `bannerUrl` | varchar, nullable | profile banner image |
| `pharmacy_profiles` | `logoUrl` | varchar, nullable | |
| `vendor_profiles` | `logoUrl` | varchar, nullable | |
| `product_media` | `mediaUrl`, `mediaType` (`image`/`video`), `isPrimary` | — | one row per product photo/video, FK `productId` → `products.id` |
| `campaign_products` | `mediaUrls` | json array, nullable | promo/campaign product images, independent of `product_media` |
| `prescriptions` | `doctorSignature` | text, nullable | base64 or URL of the doctor's signature — prescriptions themselves are structured JSON (`medications`), not scanned images |

### Relationship summary (generic system)

```
users (owner/uploader)
  └─< document_folders (folder_type: verification / pharmacy / profile / ...)
        └─< document_files (the actual file: path, hash, size, mime type)
              ├─< file_access_logs (view/download/upload/delete/share/modify + who + when)
              └─(1:1)─ pharmacy_documents (adds pharmacy-specific classification/verification)

document_folders └─< folder_access_logs (same audit shape, folder-level)
```

Doctor verification (`verification_documents`) and vendor documents
(`vendor_documents`) sit **outside** this tree — they don't reference
`document_files`/`document_folders` at all, which is why they duplicate columns like
`filePath`, `fileHash`, `mimeType` on their own tables.

---

## 8. Known rough edges (for awareness, not urgent)

- **No real thumbnails**: the system has a "thumbnail" concept in the database and a
  thumbnail URL route, but it currently just serves the full-size image — no actual
  resizing happens yet.
- **No image compression/resizing on upload**: files are stored exactly as the user
  uploaded them.
- **One known broken path**: profile pictures set through one specific "update my info"
  endpoint construct a URL that doesn't match any route the server actually serves,
  meaning those particular profile images can return a broken link. Everywhere else in
  the app, image URLs work correctly.
- **Everything in one folder**: because all files land in `uploads/images/` regardless of
  type (license PDFs, product photos, profile pictures all mixed together), this could
  become a housekeeping/performance concern as volume grows.

---

*This document reflects the current implementation as of 2026-07. It's a snapshot for
sharing/handoff purposes, not a specification — check the code if precision matters for a
change you're about to make.*
