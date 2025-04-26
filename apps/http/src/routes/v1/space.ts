import { Router } from "express";
import { AddElementSchema, CreateSpaceSchema, DeleteElementSchema } from "../../types";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";
export const spaceRouter = Router();


spaceRouter.post("/" ,userMiddleware, async (req, res) => {
    const parseData = CreateSpaceSchema.safeParse(req.body);
    console.log(parseData)
    if (!parseData.success) {
        res.status(400).json({
            message: "Invalid data",
            error: parseData.error.format()
        });
        return
    };

    if(!parseData.data.mapId){
        const space = await client.space.create({
            data: {
                name: parseData.data.name,
                width: parseInt(parseData.data.dimensions.split("x")[0]),
                height: parseInt(parseData.data.dimensions.split("x")[1]),
                creatorId: req.userId!, 
            }
        })

        res.status(200).json({
            spaceId: space.id,
            message: "Space created"
        });
    }

    const map = await client.map.findUnique({
        where:{
            id: parseData.data.mapId
        }, select:{
            mapElements: true,
            width: true,
            height: true,
            thumbnail: true
        }
    })
    if(!map){
        res.status(403).json({
            message: "Map not found"
        })
    }
    const space = await client.$transaction(async () => {
        const space = await client.space.create({
            data: {
                name: parseData.data.name,
                width: map?.width as number,
                height: map?.height as number,
                creatorId: req.userId!, 
                thumbnail: map?.thumbnail
            }
        })

        await client.spaceElements.createMany({
            data: map?.mapElements.map(e => ({
                spaceId: space.id,
                elementId: e.elementId,
                x: e.x!,
                y: e.y!,
            }) as any) || []
        })

        return space
    })

    res.status(200).json({
        spaceId: space.id,
        message: "Space created"
    });
});

spaceRouter.delete("/element", userMiddleware, async (req, res) => {

    const parsedData = DeleteElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Invalid data",
            error: parsedData.error.format()
        });
        return
    };

    const spaceElement = await client.spaceElements.findFirst({
        where: {
            id: parsedData.data.id,
        }, include: {
            space: true
        }
    })
    console.log(spaceElement?.space.creatorId, req.userId)
    if(!spaceElement?.space.creatorId || spaceElement?.space.creatorId !== req.userId){
        res.status(403).json({
            message: "You are not the creator of this space"
        })
        return
    }
    
    await client.spaceElements.delete({
        where:{
            id: parsedData.data.id,
        }
    })

    res.status(200).json({
        message: "Element deleted from space"
    })

});

spaceRouter.delete("/:spaceId", userMiddleware, async (req, res) => {
    const spaceId = req.params.spaceId;
    const space = await client.space.findUnique({
        where:{
            id: spaceId
        },select :{
            creatorId: true,
        }
    })

    if(!space){
        res.status(400).json({
            message: "Space not found"
        })
        return
    }

    if(req.userId !== space?.creatorId){
        res.status(403).json({
            message: "You are not the creator of this space"
        })
        return
    }

    await client.space.delete({
        where:{
            id: spaceId
        }
    });

    res.status(200).json({
        message: "Space deleted"
    })
});


spaceRouter.get("/all",userMiddleware, async (req, res) => {

    const spaces = await client.space.findMany({
        where:{
            creatorId: req.userId
        }
    })

    res.status(200).json({
        spaces: spaces.map(space => ({
            id: space.id,
            name: space.name,
            dimensions: `${space.width}x${space.height}`,
            thumbnail: space.thumbnail,
        }))
    })

});


spaceRouter.post("/element", userMiddleware, async(req, res) => {
    const parsedData = AddElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Invalid data",
            error: parsedData.error.format()
        });
        return
    };

    const space = await client.space.findUnique({
        where:{
            id: req.body.spaceId,
            creatorId: req.userId
        },select : {
            width: true,
            height: true,
        }
    });

    if(parsedData.data.x > space?.width! || parsedData.data.y > space?.height! || parsedData.data.x < 0 || parsedData.data.y < 0){
        res.status(400).json({
            message: "Element out of bounds"
        })
        return
    }

    if(!space){
        res.status(403).json({
            message: "Space not found"
        })
        return
    }
    

   await client.spaceElements.create({
        data:{
            spaceId: req.body.spaceId,
            elementId: parsedData.data.elementId,
            x: parsedData.data.x,
            y: parsedData.data.y,
        }
    })

    res.status(200).json({
        message: "Element added to space"
    })
});


spaceRouter.get("/:spaceId",userMiddleware, async (req, res) => {
    const space = await client.space.findUnique({
        where:{
            id: req.params.spaceId,
        }, include: {
            elements: {
                include: {
                    element: true,
                }
            }
        }
    });
    if(!space){
        res.status(404).json({
            message: "Space not found"
        })
        return
    }

    res.status(200).json({
        name: space.name,
        dimensions: `${space.width}x${space.height}`,
        elements: space.elements.map(e => ({
            id: e.id,
            element: {
                id: e.element.id,
                imageUrl: e.element.imageUrl,
                width: e.element.width,
                height: e.element.height,
                static: e.element.static,
            },
            x: e.x,
            y: e.y,
        }))
    })
});