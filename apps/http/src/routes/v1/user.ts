import { Router } from "express";
import { UpdateMetaDataSchema } from "../../types";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";

export const userRouter = Router();

userRouter.post("/metadata", userMiddleware, async (req, res) => {
    const parsedData = UpdateMetaDataSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Invalid data",
            errors: parsedData.error.errors,
        });
        return
    }

    const avatar = await client.avatar.findUnique({ where: { id: parsedData.data.avatarId } });
    if (!avatar) {
        res.status(400).json({ message: "Avatar not found" });
        return
    }

    await client.user.update({
        where: { id: req.userId },
        data: { avatarId: avatar.id },
    })

    res.status(200).json({ message: "Metadata updated successfully" })
});


userRouter.get("/metadata/bulk", userMiddleware, async (req, res) => {
    let userIds: string[];
    try {
        const parsed: unknown = JSON.parse(String(req.query.ids ?? "[]"));
        if (!Array.isArray(parsed) || parsed.length > 100 || !parsed.every((id) => typeof id === "string")) {
            throw new Error();
        }
        userIds = parsed;
    } catch {
        res.status(400).json({ message: "ids must be a JSON array of up to 100 user ids" });
        return;
    }

    const metadata = await client.user.findMany({
        where: {
            id: {
                in: userIds,
            }
        },
        select: {
            id: true,
            avatar: true,
        }
    })
    
    res.status(200).json({
        avatars: metadata.map(m => ({
            userId: m.id,
            avatarId: m.avatar?.imageUrl,
        }))
    })

})