// The empty room is a real room, not a wireframe: a warm light floor and
// matte walls. No textures. Colours stay flat so the existing lights do the
// shading.
export const ROOM_FLOOR_COLOR = '#f0d7b4';
export const ROOM_WALL_COLOR = '#f7f4ef';
export const ROOM_BACKGROUND_COLOR = '#e7eaee';
export const ROOM_WALL_THICKNESS = 0.08;

/**
 * Which walls to draw for a camera in three.js space (y up, z = room y).
 * A wall is drawn only when the camera is on its interior side, so a wall
 * between the lens and the room never blocks the view. The default empty-room
 * camera stands outside the near (−z) wall, so that front wall stays open
 * and the far wall plus both side walls read as the room.
 */
export function roomWallsFacingCamera(room, cameraPosition) {
  const halfLength = room.length / 2;
  const halfWidth = room.width / 2;
  const x = Number.isFinite(cameraPosition?.x) ? cameraPosition.x : 0;
  const z = Number.isFinite(cameraPosition?.z) ? cameraPosition.z : -room.width * 1.6;
  return {
    minX: x > -halfLength,
    maxX: x < halfLength,
    minZ: z > -halfWidth,
    maxZ: z < halfWidth,
  };
}
