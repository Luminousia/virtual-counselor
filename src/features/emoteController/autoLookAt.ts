import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";

/**
 * 目線を制御するクラス
 */
export class AutoLookAt {
  private _lookAtTarget: THREE.Object3D;
  
  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._lookAtTarget = new THREE.Object3D();
    camera.add(this._lookAtTarget);

    if (vrm.lookAt) {
      vrm.lookAt.target = this._lookAtTarget;
    }
  }
}
