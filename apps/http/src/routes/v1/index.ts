import { Router } from "express";
import { userRouter } from "./user";
import { spaceRouter } from "./space";
import { adminRouter } from "./admin";
import { SigninSchema, SignupSchema } from "../../types";
import client from "@repo/db/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JWT_SECRET } from "../../config";
import { userMiddleware } from "../../middleware/user";
import { adminMiddleware } from "../../middleware/admin";

export const router = Router();

// bcrypt hash of a random string: compared against when the username doesn't exist,
// so a failed sign-in takes the same time whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

router.post("/signup", async (req, res) => {
    const parsedData = SignupSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Invalid data",
            errors: parsedData.error.errors,
        });
        return
    }

    const { username, password } = parsedData.data;
    const existingUser = await client.user.findUnique({ where: { username } });
    if (existingUser) {
        res.status(409).json({ message: "That username is taken" });
        return
    }

    const user = await client.user.create({
        data: {
            username,
            password: await bcrypt.hash(password, 10),
            role: "User",
        }
    })
    res.status(200).json({ userId: user.id })
})

router.post("/signin", async (req, res) => {
    const parsedData = SigninSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(401).json({ message: "Invalid username or password" });
        return
    }

    const user = await client.user.findUnique({
        where: { username: parsedData.data.username },
    })
    const isPasswordValid = await bcrypt.compare(parsedData.data.password, user?.password ?? DUMMY_HASH);
    if (!user || !isPasswordValid) {
        res.status(401).json({ message: "Invalid username or password" });
        return
    }

    const token = jwt.sign({
        userId: user.id,
        role: user.role,
    }, JWT_SECRET, { expiresIn: "7d", algorithm: "HS256" });

    res.status(200).json({ token })
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
            static: e.static,
            layer: e.layer,
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

router.get("/avatar", userMiddleware, async( req, res) => {
    if(!req.query.id){
        res.status(400).json({
            message: "Avatar id is required"
        })
        return
    }
    const user = await client.user.findUnique({
        where: { id: String(req.query.id) },
        select: { avatar: { select: { imageUrl: true } } },
    });

    res.json({
        avatar: {
            imageUrl: user?.avatar?.imageUrl ?? null,
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
            spawnX: m.spawnX,
            spawnY: m.spawnY,
            defaultElement: m.mapElements.map(e => ({
                elementId: e.elementId,
                x: e.x,
                y: e.y
            }))
        }))
    })
})

router.get("/users", adminMiddleware, async (req, res) => {
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