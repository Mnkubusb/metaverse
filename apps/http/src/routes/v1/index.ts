import { Router } from "express";
import { userRouter } from "./user";
import { spaceRouter } from "./space";
import { adminRouter } from "./admin";
import { SigninSchema, SignupSchema } from "../../types";
import client from "@repo/db/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../config";

export const router = Router();

router.post("/signup", async (req, res) => {
    const parsedData = SignupSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Invalid data",
            errors: parsedData.error.errors,
        });
        return
    }

    const hashedPassword = await bcrypt.hash(parsedData.data.password, 10);
    try {
        // Check if the user already exists
        const existingUser = await client.user.findUnique({
            where: {
                username: parsedData.data.username,
            }
        });
        if (existingUser) {
            res.status(400).json({
                message: "User already exists",
            });
            return
        }

        const user = await client.user.create({
            data: {
                username: parsedData.data.username,
                password: hashedPassword,
                role: parsedData.data.type === "admin" ? "Admin" : "User",
            }
        })
        res.status(200).json({
            userId: user.id,
        })
    } catch (error) {
        res.status(500).json({
            error,
            message: "Internal server error",
        });
    }

})

router.post("/signin", async (req, res) => {
    
    const parsedData = SigninSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Invalid data",
            errors: parsedData.error.errors,
        });
        return
    };

    try {
        const user = await client.user.findUnique({
            where: {
                username: parsedData.data.username,
            }
        })

        if (!user) {
            res.status(400).json({
                message: "User not found",
            });
            return
        }

        const isPasswordValid = await bcrypt.compare(parsedData.data.password, user.password);

        if (!isPasswordValid) {
            res.status(403).json({
                message: "Invalid password",
            });
            return  
        }
        const token = jwt.sign({
            userId: user.id,
            role: user.role,
        }, JWT_SECRET, { expiresIn: "7d" });

        res.status(200).json({
            token
        })

    } catch (error) {
        console.log(error);
        res.status(400).json({
            message: "Internal server error",
        });
    }
})


router.get("/elements", async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const elements = await client.element.findMany({
        skip: (page - 1) * limit,
        take: limit,
    });
    res.json({
        elements: elements.map(e => ({
            id: e.id,
            imageUrl: e.imageUrl,
            width: e.width,
            height: e.height,
            static: e.static
        })),
        page,
        limit,
    })
});

router.get("/avatars", async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const avatars = await client.avatar.findMany({
        skip: (page - 1) * limit,
        take: limit,
    });
    res.json({
        avatars: avatars.map(a => ({
            id: a.id,
            imageUrl: a.imageUrl,
            name: a.name
        })),
        page,
        limit,
    })
})

router.get("/avatar", async( req, res) => {
    if(!req.query.id){
        res.status(400).json({
            message: "Avatar id is required"
        })
        return
    }
    const user = await client.user.findUnique({
        where: {
            id: req.query.id as string
        }
    });
    const avatar = await client.avatar.findUnique({
        where:{
            id: user?.avatarId as string
        }
    });

    res.json({
        avatar: {
            imageUrl: avatar?.imageUrl,
        }
    })
})

router.get("/maps", async (req, res) => {
    const maps = await client.map.findMany({
        include:{
            mapElements: {
                include: {
                    element: true
                }
            }
        }
    });
    res.json({
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

router.get("/users", async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const users = await client.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
    });
    res.json({
        users: users.map(u => ({
            id: u.id,
            username: u.username,
            role: u.role,
        })),
        page,
        limit,
    });
})


router.use("/user", userRouter);
router.use("/space", spaceRouter);
router.use("/admin", adminRouter);