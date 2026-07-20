import { Router, type IRouter } from "express";
import healthRouter from "./health";
import animeRouter from "./anime";
import streamRouter from "./stream";

const router: IRouter = Router();

router.use(healthRouter);
router.use(animeRouter);
router.use(streamRouter);

export default router;
