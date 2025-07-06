import z from 'zod'

export const SignupSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(8).max(20),
    type: z.enum(['user', 'admin']),
})

export const SigninSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(8).max(20),
})

export const UpdateMetaDataSchema = z.object({
    avatarId: z.string()
})

export const CreateSpaceSchema = z.object({
    name: z.string(),
    dimensions : z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
    mapId: z.string().optional(),
})

export const AddElementSchema = z.object({
    spaceId: z.string(),
    elementId: z.string(),
    x: z.number(),
    y: z.number(),
})

export const DeleteElementSchema = z.object({
    id: z.string(),
})

export const CreateElementSchema = z.object({
    imageUrl: z.string(),
    width: z.number(),
    height: z.number(),
    static: z.boolean(),
})

export const UpdateElementSchema = z.object({
    imageUrl: z.string(),
})

export const CreateAvatarSchema = z.object({
    name: z.string(),
    imageUrl: z.string(),
})

export const CreateMapSchema = z.object({
    thumbnail: z.string(),
    dimensions: z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
    name: z.string(),
    defaultElement: z.array(z.object({
        id: z.string().optional(),
        elementId: z.string(),
        x: z.number(),
        y: z.number(),
    }))
})

declare global {
    namespace Express {
        export interface Request {
            role: "Admin" | "User"; 
            userId: string;
        }
    }
}



