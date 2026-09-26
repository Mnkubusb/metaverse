import z from 'zod'

// Asset URLs must be site-relative paths or http(s) links (no javascript:/data: URLs).
const assetUrl = z.string().max(2048).regex(/^(\/(?!\/)|https?:\/\/)/, "Must be a /path or an http(s) URL");

// Accounts are always created as regular users; admins are promoted with `pnpm db:make-admin`.
export const SignupSchema = z.object({
    username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, dots, dashes and underscores only"),
    // bcrypt only uses the first 72 bytes
    password: z.string().min(8).max(72),
})

// Deliberately loose so validation errors don't reveal the signup rules for existing accounts
export const SigninSchema = z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(1).max(72),
})

export const UpdateMetaDataSchema = z.object({
    avatarId: z.string().min(1).max(64)
})

export const CreateSpaceSchema = z.object({
    name: z.string().min(1).max(100),
    dimensions: z.string().regex(/^[0-9]{1,3}x[0-9]{1,3}$/).refine(
        (d) => {
            const [w, h] = d.split("x").map(Number);
            return w >= 1 && w <= 200 && h >= 1 && h <= 200;
        },
        { message: "Dimensions must be between 1x1 and 200x200" }
    ),
    mapId: z.string().optional(),
    visibility: z.enum(["Private", "Unlisted", "Public"]).optional(),
})

export const UpdateSpaceSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    visibility: z.enum(["Private", "Unlisted", "Public"]).optional(),
})

export const NoticeSchema = z.object({
    body: z.string().trim().min(1).max(280),
    color: z.enum(["yellow", "blue", "pink", "green", "white"]).default("yellow"),
})

export const JoinSpaceSchema = z.object({
    inviteCode: z.string().max(64).optional(),
})

export const AddElementSchema = z.object({
    spaceId: z.string(),
    elementId: z.string(),
    x: z.number().int(),
    y: z.number().int(),
})

export const DeleteElementSchema = z.object({
    id: z.string(),
})

export const CreateElementSchema = z.object({
    imageUrl: assetUrl,
    width: z.number().int().min(1).max(50),
    height: z.number().int().min(1).max(50),
    static: z.boolean(),
    layer: z.enum(["floor","wall","objects","topObjects"])
})

export const UpdateElementSchema = z.object({
    imageUrl: assetUrl,
})

export const CreateAvatarSchema = z.object({
    name: z.string().min(1).max(100),
    imageUrl: assetUrl,
})

export const CreateMapSchema = z.object({
    thumbnail: assetUrl,
    dimensions: z.string().regex(/^[0-9]{1,3}x[0-9]{1,3}$/),
    name: z.string().min(1).max(100),
    spawnX: z.number().int().min(0).optional(),
    spawnY: z.number().int().min(0).optional(),
    defaultElement: z.array(z.object({
        id: z.string().optional(),
        elementId: z.string(),
        x: z.number().int().min(0),
        y: z.number().int().min(0),
    })).max(20000)
})

declare global {
    namespace Express {
        export interface Request {
            role: "Admin" | "User"; 
            userId: string;
        }
    }
}



