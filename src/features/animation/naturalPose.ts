import { VRM } from "@pixiv/three-vrm";

// 姿势类型
export type PoseType = 'natural' | 'i-pose' | 'a-pose' | 't-pose' | 'counselor';

// 当前姿势配置
let currentPoseType: PoseType = 'counselor'; // 默认使用咨询师姿势

// I-Pose: 手臂完全下垂，贴近身体（约75度）
const I_POSE_ARM_Z = 1.3;  // ~75度，手臂下垂

// A-Pose: 手臂略微张开，约30度
const A_POSE_ARM_Z = 0.52;  // ~30度

/**
 * 设置当前姿势类型
 */
export function setPoseType(poseType: PoseType) {
  currentPoseType = poseType;
  console.log('[Pose] 姿势类型设置为:', poseType);
}

/**
 * 获取当前姿势类型
 */
export function getPoseType(): PoseType {
  return currentPoseType;
}

/**
 * 设置 VRM 模型为 I-Pose（手臂下垂）
 */
export function setIPose(vrm: VRM) {
  try {
    const humanoid = vrm.humanoid;
    if (!humanoid) {
      console.warn('[IPose] humanoid not found');
      return;
    }
    
    console.log('[IPose] 设置 I-Pose 姿势');
    
    // 上臂几乎垂直下垂
    const leftUpperArm = humanoid.getRawBoneNode("leftUpperArm");
    if (leftUpperArm) {
      leftUpperArm.rotation.z = I_POSE_ARM_Z;
      leftUpperArm.rotation.x = 0;
      leftUpperArm.rotation.y = 0;
    }
    
    const rightUpperArm = humanoid.getRawBoneNode("rightUpperArm");
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -I_POSE_ARM_Z;
      rightUpperArm.rotation.x = 0;
      rightUpperArm.rotation.y = 0;
    }
    
    // 下臂保持自然
    const leftLowerArm = humanoid.getRawBoneNode("leftLowerArm");
    if (leftLowerArm) {
      leftLowerArm.rotation.set(0, 0, 0);
    }
    
    const rightLowerArm = humanoid.getRawBoneNode("rightLowerArm");
    if (rightLowerArm) {
      rightLowerArm.rotation.set(0, 0, 0);
    }
    
    vrm.scene.updateMatrixWorld(true);
    console.log('[IPose] 完成');
    
  } catch (error) {
    console.error('[IPose] 错误:', error);
  }
}

/**
 * 设置咨询师亲和力姿势
 * 双手自然交叠在身前，显得亲切、专业
 */
export function setCounselorPose(vrm: VRM) {
  try {
    const humanoid = vrm.humanoid;
    if (!humanoid) {
      console.warn('[CounselorPose] humanoid not found');
      return;
    }
    
    console.log('[CounselorPose] 设置咨询师亲和力姿势');
    
    // === 左臂 ===
    const leftUpperArm = humanoid.getRawBoneNode("leftUpperArm");
    if (leftUpperArm) {
      leftUpperArm.rotation.z = 1.1;   // 手臂下垂
      leftUpperArm.rotation.x = 0.3;   // 略微向前
      leftUpperArm.rotation.y = 0;
    }
    
    const leftLowerArm = humanoid.getRawBoneNode("leftLowerArm");
    if (leftLowerArm) {
      leftLowerArm.rotation.z = 0;
      leftLowerArm.rotation.x = 0;
      leftLowerArm.rotation.y = -1.2;  // 弯曲向身体中心
    }
    
    // === 右臂 ===
    const rightUpperArm = humanoid.getRawBoneNode("rightUpperArm");
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -1.1;  // 手臂下垂
      rightUpperArm.rotation.x = 0.3;   // 略微向前
      rightUpperArm.rotation.y = 0;
    }
    
    const rightLowerArm = humanoid.getRawBoneNode("rightLowerArm");
    if (rightLowerArm) {
      rightLowerArm.rotation.z = 0;
      rightLowerArm.rotation.x = 0;
      rightLowerArm.rotation.y = 1.2;   // 弯曲向身体中心
    }
    
    // === 手部（如果有的话）===
    const leftHand = humanoid.getRawBoneNode("leftHand");
    if (leftHand) {
      leftHand.rotation.x = 0.2;
      leftHand.rotation.y = 0;
      leftHand.rotation.z = 0;
    }
    
    const rightHand = humanoid.getRawBoneNode("rightHand");
    if (rightHand) {
      rightHand.rotation.x = 0.2;
      rightHand.rotation.y = 0;
      rightHand.rotation.z = 0;
    }
    
    vrm.scene.updateMatrixWorld(true);
    console.log('[CounselorPose] 完成');
    
  } catch (error) {
    console.error('[CounselorPose] 错误:', error);
  }
}

/**
 * 设置 VRM 模型为自然站立姿势（A-Pose变体）
 */
export function setNaturalPose(vrm: VRM) {
  // 根据当前配置选择姿势
  if (currentPoseType === 'counselor') {
    setCounselorPose(vrm);
    return;
  }
  
  if (currentPoseType === 'i-pose') {
    setIPose(vrm);
    return;
  }
  
  try {
    const humanoid = vrm.humanoid;
    if (!humanoid) {
      console.warn('[naturalPose] humanoid not found');
      return;
    }
    
    console.log('[naturalPose] 设置自然站立姿势');
    
    const leftUpperArm = humanoid.getRawBoneNode("leftUpperArm");
    if (leftUpperArm) {
      leftUpperArm.rotation.z = A_POSE_ARM_Z;
    }
    
    const rightUpperArm = humanoid.getRawBoneNode("rightUpperArm");
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -A_POSE_ARM_Z;
    }
    
    vrm.scene.updateMatrixWorld(true);
    console.log('[naturalPose] 完成');
    
  } catch (error) {
    console.error('[naturalPose] 错误:', error);
  }
}

/**
 * 在动画循环中强制保持手臂姿势
 * 注意：只保持 Z 轴旋转（手臂张开角度），不覆盖 X 轴（允许动画）
 */
export function maintainArmPose(vrm: VRM) {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;
  
  // 咨询师姿势需要特殊处理
  if (currentPoseType === 'counselor') {
    // 左臂 - 只保持 Z 轴，X 轴由动画控制
    const leftUpperArm = humanoid.getRawBoneNode("leftUpperArm");
    if (leftUpperArm) {
      leftUpperArm.rotation.z = 1.1;
      // 不覆盖 rotation.x，让动画控制
    }
    const leftLowerArm = humanoid.getRawBoneNode("leftLowerArm");
    if (leftLowerArm) {
      leftLowerArm.rotation.y = -1.2;
    }
    
    // 右臂 - 只保持 Z 轴，X 轴由动画控制
    const rightUpperArm = humanoid.getRawBoneNode("rightUpperArm");
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -1.1;
      // 不覆盖 rotation.x，让动画控制
    }
    const rightLowerArm = humanoid.getRawBoneNode("rightLowerArm");
    if (rightLowerArm) {
      rightLowerArm.rotation.y = 1.2;
    }
    return;
  }
  
  // 其他姿势类型
  const armZ = currentPoseType === 'i-pose' ? I_POSE_ARM_Z : A_POSE_ARM_Z;
  
  const leftUpperArm = humanoid.getRawBoneNode("leftUpperArm");
  if (leftUpperArm) {
    leftUpperArm.rotation.z = armZ;
  }
  
  const rightUpperArm = humanoid.getRawBoneNode("rightUpperArm");
  if (rightUpperArm) {
    rightUpperArm.rotation.z = -armZ;
  }
}

/**
 * 设置 A-Pose（备用）
 */
export function setAPose(vrm: VRM) {
  try {
    const humanoid = vrm.humanoid;
    
    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    if (leftUpperArm) {
      leftUpperArm.rotation.z = 0.52;
      leftUpperArm.rotation.x = 0;
      leftUpperArm.rotation.y = 0;
      leftUpperArm.updateMatrixWorld(true);
    }
    
    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -0.52;
      rightUpperArm.rotation.x = 0;
      rightUpperArm.rotation.y = 0;
      rightUpperArm.updateMatrixWorld(true);
    }
    
    console.log('=== A-Pose 设置完成 ===');
  } catch (error) {
    console.error('设置 A-Pose 时出错:', error);
  }
}

/**
 * 设置 T-Pose（调试用）
 */
export function setTPose(vrm: VRM) {
  try {
    const humanoid = vrm.humanoid;
    
    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    if (leftUpperArm) {
      leftUpperArm.rotation.set(0, 0, 0);
      leftUpperArm.updateMatrixWorld(true);
    }
    
    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    if (rightUpperArm) {
      rightUpperArm.rotation.set(0, 0, 0);
      rightUpperArm.updateMatrixWorld(true);
    }
    
    const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
    if (leftLowerArm) {
      leftLowerArm.rotation.set(0, 0, 0);
      leftLowerArm.updateMatrixWorld(true);
    }
    
    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
    if (rightLowerArm) {
      rightLowerArm.rotation.set(0, 0, 0);
      rightLowerArm.updateMatrixWorld(true);
    }
    
    console.log('=== T-Pose 设置完成 ===');
  } catch (error) {
    console.error('设置 T-Pose 时出错:', error);
  }
}
