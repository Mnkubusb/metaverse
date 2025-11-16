import { Router } from "express";
import { adminMiddleware } from "../../middleware/admin";
import { CreateAvatarSchema, CreateElementSchema, CreateMapSchema, UpdateElementSchema } from "../../types";
import client from "@repo/db/client";

export const adminRouter = Router();

adminRouter.post("/element", adminMiddleware, async (req, res) => {
    const parsedData = CreateElementSchema.safeParse(req.body);
    console.log(parsedData.data)
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
           static: parsedData.data.static,
           layer: parsedData.data.layer
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
adminRouter.delete("/element/:elementId", adminMiddleware, async (req, res) => {
    await client.element.delete({
        where: {
            id: req.params.elementId
        }
    })
    res.status(200).json({
        message: "Element deleted"
    })
})
adminRouter.delete("/map/:mapId", adminMiddleware, async (req, res) => {
    await client.map.delete({
        where: {
            id: req.params.mapId
        }
    })
    res.status(200).json({
        message: "Map deleted"
    })  
})
adminRouter.get("/map/:mapId", adminMiddleware, async (req, res) => {
    const map = await client.map.findUnique({
        where: {
            id: req.params.mapId
        }, include: {
            mapElements: {
                include: {
                    element: true
                }
            }
        }
    })    
    if(!map){
        res.status(404).json({
            message: "Map not found"
        })
        return
    }
    res.status(200).json({
        name: map.name,
        thumbnail: map.thumbnail,
        dimensions: `${map.width}x${map.height}`,
        elements: map.mapElements.map(e => ({
            id: e.id,
            element: {
                id: e.element.id,
                imageUrl: e.element.imageUrl,
                width: e.element.width,
                height: e.element.height,
                static: e.element.static,
            },
            x: e.x,
            y: e.y            
        }))        
    })
})

adminRouter.get("/maps", adminMiddleware, async (req, res) => {
    console.log(req.body)
    const maps = await client.map.findMany({
        include: {
            mapElements: {
                include: {
                    element: true
                }
            }
        }
    });
    res.status(200).json({
        maps: maps.map(m => ({
            id: m.id,
            name: m.name,
            thumbnail: m.thumbnail,
            width: m.width,
            height: m.height,
            defaultElement: m.mapElements.map(e => ({
                elementId: e.elementId,
                x: e.x,
                y: e.y
            }))            
        }))
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
adminRouter.put("/map/:mapId", adminMiddleware, async (req, res) => {
    const parsedData = CreateMapSchema.safeParse(req.body);
    if(!parsedData.success){
        res.status(400).json({
            message: "validation failed"
        })
        return
    }

    const { name, dimensions, thumbnail, defaultElement } = parsedData.data;
    const [width, height] = dimensions.split("x").map(Number);
    const mapId = req.params.mapId;

    try {
        // 1. Update map meta (no transaction needed)
        const map = await client.map.update({
            where: { id: mapId },
            data: { name, width, height, thumbnail }
        });

        // 2. Get existing element IDs for the map
        const existingElements = await client.mapElements.findMany({
            where: { mapId },
            select: { id: true }
        });

        const existingIds = new Set(existingElements.map(e => e.id));
        const incomingIds = new Set(defaultElement.filter(e => e.id).map(e => e.id!));

        // 3. Identify elements to delete
        const toDelete = [...existingIds].filter(id => !incomingIds.has(id));

        // 4. Separate elements to create and update
        const toUpdate = defaultElement.filter(e => e.id);
        const toCreate = defaultElement.filter(e => !e.id);

        // 5. Perform deletions, creations, and updates
        await client.$transaction([
            ...(toDelete.length > 0
                ? [
                    client.mapElements.deleteMany({
                        where: { id: { in: toDelete } }
                    })
                ]
                : []),

            ...(toCreate.length > 0
                ? [
                    client.mapElements.createMany({
                        data: toCreate.map(e => ({
                            x: e.x,
                            y: e.y,
                            elementId: e.elementId,
                            mapId
                        }))
                    })
                ]
                : []),

            // Updates can be run in parallel and outside transaction if needed
        ]);

        // 6. Update existing elements in parallel (no need to be in transaction)
        await Promise.all(
            toUpdate.map(e =>
                client.mapElements.update({
                    where: { id: e.id },
                    data: { x: e.x, y: e.y }
                })
            )
        );
        
        res.status(200).json({ id: map.id });
    } catch (error) {
        console.error("Map update failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
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

