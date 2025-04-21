import { Router } from "express";
import { adminMiddleware } from "../../middleware/admin";
import { CreateAvatarSchema, CreateElementSchema, CreateMapSchema, UpdateElementSchema } from "../../types";
import client from "@repo/db/client";

export const adminRouter = Router();

adminRouter.post("/element", adminMiddleware, async (req, res) => {
    const parsedData = CreateElementSchema.safeParse(req.body);
    if(!parsedData.success){
        res.status(400).json({
            message: "validation failed"
        })
        return
    }

   const element = await client.element.create({
       data: {
           imageUrl: parsedData.data.imageUrl,
           width: parsedData.data.width,
           height: parsedData.data.height,
           static: parsedData.data.static
       }
   }) 

   res.status(200).json({
        id: element.id,
        message: "Element created"
   })
});

adminRouter.post("/avatar", adminMiddleware, async (req, res) => {
    const parsedData = CreateAvatarSchema.safeParse(req.body);
    if(!parsedData.success){
        res.status(400).json({
            message: "validation failed"
        })
        return
    }

    const avatar = await client.avatar.create({
        data: {
            imageUrl: parsedData.data.imageUrl,
            name: parsedData.data.name
        }
    })

    res.status(200).json({
        id: avatar.id,
        message: "Avatar created"
    })
})
adminRouter.post("/map",adminMiddleware, async (req, res) => {
    console.log(req.body)
    const parsedData = CreateMapSchema.safeParse(req.body);
    console.log(parsedData.data)
    if(!parsedData.success){
        res.status(400).json({
            message: "validation failed"
        })
        return
    }

    const map = await client.map.create({
        data:{
            name: parsedData.data.name,
            width: parseInt(parsedData.data.dimensions.split("x")[0]),
            height: parseInt(parsedData.data.dimensions.split("x")[1]),
            thumbnail: parsedData.data.thumbnail,
            mapElements: {
                create: parsedData.data.defaultElement.map(e => ({
                    elementId: e.elementId,
                    x: e.x,
                    y: e.y
                }))
            }
        }
    })
    res.status(200).json({
        id: map.id,
    })
})
adminRouter.put("/element/:elementId", adminMiddleware, async (req, res) => {
    const parsedData = UpdateElementSchema.safeParse(req.body);
    if(!parsedData.success){
        res.status(400).json({
            message: "validation failed"
        })
        return
    }
    
    const response = await client.element.update({
        where: {
            id: req.params.elementId
        },
        data: {
            imageUrl: parsedData.data.imageUrl,
        }
    })
    res.status(200).json({
        message: "Element updated"
    })
})

