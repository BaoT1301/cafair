import { createTRPCRouter } from "@/server/init";
import {
  list,
  getById,
  create,
  update,
  deleteExample,
  listPublic,
} from "./crud";

export const examplesRouter = createTRPCRouter({
  list,
  getById,
  create,
  update,
  delete: deleteExample,
  listPublic,
});
