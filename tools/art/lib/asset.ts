/** One generated texture: key, output location and a renderer. */
export interface ArtAsset {
  /** Phaser texture key (pinned in the plan). */
  key: string;
  /** Sub-directory under public/assets/art. */
  dir: string;
  width: number;
  height: number;
  render(): string;
}
