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

   try {
     await client.user.update({
         where: {
             id: req.userId,
         },
         data: {
             avatarId: parsedData.data.avatarId,
         }
     })
 
     res.status(200).json({
         message: "Metadata updated successfully",
     })

   } catch(error) {
        console.log(error)
        res.status(400).json({
            message: "Internal server error",
        })
   }

});


userRouter.get("/metadata/bulk", async (req, res) => {
    
    const userIdString = (req.query.ids ?? "[]") as string;
    const userIds = (userIdString).slice(1, userIdString?.length-2).split(",");

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