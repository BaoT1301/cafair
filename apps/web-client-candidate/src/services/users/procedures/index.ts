import { createTRPCRouter } from "@/server/init";
import { getMe } from "./get-me";
import { updateProfile } from "./update-profile";
import { syncFromClerk } from "./sync-from-clerk";

export const usersRouter = createTRPCRouter({
  getMe,
  updateProfile,
  syncFromClerk,
});
