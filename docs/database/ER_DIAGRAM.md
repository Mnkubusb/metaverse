# VirtuSpace data model

Source of truth: [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma).
This document reflects the database after migration `20260926000000_space_membership`
(PostgreSQL 16, Prisma 6). Constraint actions and indexes below were read from a
migrated database, not inferred from the Prisma file.

## Current schema

```mermaid
erDiagram
    User {
        text id PK "cuid()"
        text username UK
        text password "bcrypt hash"
        text avatarId FK "nullable"
        Role role "Admin | User"
    }
    Avatar {
        text id PK "cuid()"
        text imageUrl "nullable, sprite sheet URL"
        text name "nullable"
    }
    Space {
        text id PK "cuid()"
        text name
        int width "tiles"
        int height "tiles"
        text thumbnail "nullable"
        int spawnX "nullable"
        int spawnY "nullable"
        Visibility visibility "Private | Unlisted | Public"
        text inviteCode UK "secret part of the invite link"
        timestamp createdAt
        text creatorId FK
    }
    SpaceMember {
        text spaceId PK,FK
        text userId PK,FK
        SpaceRole role "Owner | Member"
        timestamp joinedAt
    }
    spaceElements {
        text id PK "cuid()"
        text spaceId FK
        text elementId FK
        int x "tile column"
        int y "tile row"
    }
    Element {
        text id PK "cuid() or stable seed id"
        int width "tiles"
        int height "tiles"
        boolean static "blocks movement"
        text imageUrl
        Layer layer "floor | wall | objects | topObjects"
    }
    Map {
        text id PK "cuid() or stable seed id"
        text name
        int width "tiles"
        int height "tiles"
        text thumbnail
        int spawnX "nullable"
        int spawnY "nullable"
    }
    mapElements {
        text id PK "cuid()"
        text mapId FK
        text elementId FK
        int x "tile column"
        int y "tile row"
    }
    ChatMessage {
        text id PK "cuid()"
        text spaceId FK
        text authorId FK "nullable"
        text body "1-500 chars"
        timestamp createdAt "indexed with spaceId"
    }

    Avatar |o--o{ User : "worn by (ON DELETE SET NULL)"
    User ||--o{ Space : "creates (ON DELETE RESTRICT)"
    Space ||--o{ spaceElements : "contains (ON DELETE CASCADE)"
    Element ||--o{ spaceElements : "placed as (ON DELETE RESTRICT)"
    Map ||--o{ mapElements : "contains (ON DELETE CASCADE)"
    Element ||--o{ mapElements : "placed as (ON DELETE RESTRICT)"
    Map |o..o{ Space : "copied into at creation (no FK)"
    Space ||--o{ ChatMessage : "hosts (ON DELETE CASCADE)"
    User |o--o{ ChatMessage : "writes (ON DELETE SET NULL)"
    Space ||--o{ SpaceMember : "has members (ON DELETE CASCADE)"
    User ||--o{ SpaceMember : "belongs to (ON DELETE CASCADE)"
```

A **Map** is an admin-authored template. Creating a **Space** from a map copies the map's
size, thumbnail, spawn point and every `mapElements` row into `spaceElements`; after that the
space is independent, so editing a map never changes existing spaces. The dotted line marks
this copy relationship, which has no foreign key.

## Relationships

| Parent | Child | Cardinality | FK column | ON DELETE | ON UPDATE |
|---|---|---|---|---|---|
| Avatar | User | 0..1 to many | `User.avatarId` (nullable) | SET NULL | CASCADE |
| User | Space | 1 to many | `Space.creatorId` | RESTRICT | CASCADE |
| Space | spaceElements | 1 to many | `spaceElements.spaceId` | CASCADE | CASCADE |
| Element | spaceElements | 1 to many | `spaceElements.elementId` | RESTRICT | CASCADE |
| Map | mapElements | 1 to many | `mapElements.mapId` | CASCADE | CASCADE |
| Element | mapElements | 1 to many | `mapElements.elementId` | RESTRICT | CASCADE |
| Space | ChatMessage | 1 to many | `ChatMessage.spaceId` | CASCADE | CASCADE |
| User | ChatMessage | 0..1 to many | `ChatMessage.authorId` (nullable) | SET NULL | CASCADE |
| Space | SpaceMember | 1 to many | `SpaceMember.spaceId` | CASCADE | CASCADE |
| User | SpaceMember | 1 to many | `SpaceMember.userId` | CASCADE | CASCADE |

**Access rule:** a player may enter a space when they have a `SpaceMember` row, or when the space is
not `Private`. Entering an Unlisted/Public space, or a Private one with the correct `inviteCode`, creates
a `Member` row. The creator is the `Owner`. Enforced in both `apps/http/src/access.ts` and the WS join.

Chat messages are written by the WebSocket server (validated, max 500 characters, rate-limited
to a burst of 5 then one every 2 seconds). The last 50 are sent to a player when they join.

## Enums

| Enum | Values | Used by |
|---|---|---|
| `Role` | `Admin`, `User` | `User.role` |
| `Layer` | `floor`, `wall`, `objects`, `topObjects` | `Element.layer` |
| `Visibility` | `Private`, `Unlisted`, `Public` | `Space.visibility` (default `Unlisted`) |
| `SpaceRole` | `Owner`, `Member` | `SpaceMember.role` |

`Layer` drives both drawing order and collision (see the README's "Editing the campus map"):
`floor` never blocks, `wall` blocks its whole footprint, `objects` blocks its bottom row and is
depth-sorted with players, `topObjects` is drawn above players and never blocks.

## Indexes

| Table | Index | Columns | Notes |
|---|---|---|---|
| User | `User_pkey` / `User_id_key` | id | duplicate (see findings) |
| User | `User_username_key` | username | unique |
| Space | `Space_pkey` / `Space_id_key` | id | duplicate |
| Space | `Space_creatorId_idx` | creatorId | |
| spaceElements | `spaceElements_pkey` / `_id_key` | id | duplicate |
| spaceElements | `spaceElements_spaceId_idx` | spaceId | |
| spaceElements | `spaceElements_elementId_idx` | elementId | |
| mapElements | `mapElements_pkey` / `_id_key` | id | duplicate |
| mapElements | `mapElements_mapId_idx` | mapId | |
| ChatMessage | `ChatMessage_spaceId_createdAt_idx` | spaceId, createdAt | serves "latest N messages in a space" |
| Space | `Space_inviteCode_key` | inviteCode | unique |
| Space | `Space_visibility_createdAt_idx` | visibility, createdAt | serves the Explore page |
| SpaceMember | `SpaceMember_pkey` | spaceId, userId | composite primary key |
| SpaceMember | `SpaceMember_userId_idx` | userId | serves "spaces I've joined" |
| Element, Map, Avatar | `*_pkey` / `*_id_key` | id | duplicate |

## Findings for production

| Severity | Finding | Fix |
|---|---|---|
| High | `Element` rows referenced by a map or space cannot be deleted (RESTRICT), so `DELETE /admin/element/:id` returns a 500 for any element in use. | Soft-delete elements (`deletedAt`) and hide them from the palette, or block the delete with a clear 409. |
| High | A `User` who owns spaces cannot be deleted (RESTRICT). There is no account-deletion path. | Decide ownership on deletion: cascade the user's spaces, or transfer them, then change the FK action. |
| Medium | Every table declares `@id @unique`, which creates a second unique index on the primary key. Each write maintains two identical B-trees. | Drop `@unique` from the `id` fields; the migration drops the `*_id_key` indexes. |
| Medium | `mapElements.elementId` has no index (unlike `spaceElements.elementId`), so checking whether an element is used scans the table. | Add `@@index([elementId])` to `mapElements`. |
| Medium | Most tables have no `createdAt` / `updatedAt` (only `Space`, `SpaceMember` and `ChatMessage` do), so there is no audit trail. | Add `createdAt @default(now())` and `updatedAt @updatedAt` everywhere. |
| Low | Space does not remember which map it came from. | Add a nullable `Space.mapId` FK with ON DELETE SET NULL. |
| Low | Table names mix casing (`User`, `spaceElements`, `mapElements`). | Rename the models to PascalCase and keep the table names with `@@map`, so no data moves. |
| Low | Element placements have no uniqueness rule, so the same element can be stacked on the same tile. | Add `@@unique([spaceId, elementId, x, y])` (and the same for maps) after de-duplicating. |

## Target model (proposed)

This is the recommended next shape of the schema. New tables are marked **new**; columns
that do not exist yet are marked **new** in their comment. It adds refresh-token sessions so JWTs can
be revoked, and timestamps. `ChatMessage`, `SpaceMember` and space visibility already exist.

```mermaid
erDiagram
    User {
        text id PK
        text username UK
        text passwordHash
        text avatarId FK "nullable"
        Role role "Admin | User"
        timestamptz createdAt "new"
        timestamptz updatedAt "new"
    }
    Session {
        text id PK "new table"
        text userId FK
        text refreshTokenHash UK
        timestamptz expiresAt
        timestamptz revokedAt "nullable"
        timestamptz createdAt
    }
    Avatar {
        text id PK
        text name
        text imageUrl
    }
    Space {
        text id PK
        text name
        int width
        int height
        text thumbnail "nullable"
        int spawnX "nullable"
        int spawnY "nullable"
        Visibility visibility "new: Private | Unlisted | Public"
        text inviteCode UK "new, nullable"
        text creatorId FK
        text mapId FK "new, nullable, SET NULL"
        timestamptz createdAt "new"
        timestamptz updatedAt "new"
    }
    SpaceMember {
        text spaceId PK,FK
        text userId PK,FK
        SpaceRole role "Owner | Admin | Member | Guest"
        timestamptz joinedAt
    }
    ChatMessage {
        text id PK
        text spaceId FK
        text authorId FK "nullable, SET NULL"
        text body
        timestamptz createdAt "indexed with spaceId"
    }
    SpaceElement {
        text id PK
        text spaceId FK
        text elementId FK
        int x
        int y
    }
    Element {
        text id PK
        text name "new"
        int width
        int height
        boolean static
        text imageUrl
        Layer layer
        timestamptz deletedAt "new, soft delete"
    }
    Map {
        text id PK
        text name
        int width
        int height
        text thumbnail
        int spawnX "nullable"
        int spawnY "nullable"
        timestamptz createdAt "new"
        timestamptz updatedAt "new"
    }
    MapElement {
        text id PK
        text mapId FK
        text elementId FK "new index"
        int x
        int y
    }

    Avatar |o--o{ User : "worn by"
    User ||--o{ Session : "signs in with"
    User ||--o{ Space : "creates"
    User ||--o{ SpaceMember : "belongs to"
    Space ||--o{ SpaceMember : "has members"
    Space ||--o{ ChatMessage : "hosts"
    User |o--o{ ChatMessage : "writes"
    Space ||--o{ SpaceElement : "contains"
    Element ||--o{ SpaceElement : "placed as"
    Map ||--o{ MapElement : "contains"
    Element ||--o{ MapElement : "placed as"
    Map |o--o{ Space : "template for"
```
