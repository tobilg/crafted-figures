import {box,profile,createStage} from 'crafted-figures/three';import type {Configuration} from 'crafted-figures/contracts';
const config:Configuration={schemaVersion:2,camera:{azimuth:45,elevation:30}};
const stage=createStage({config,bounds:[[-10,-10,-10],[10,10,10]]});stage.scene.add(box('base',{width:20,depth:20,height:4}),profile('body',{radius:z=>4+z*z,zMin:-1,zMax:1}));
// @ts-expect-error public geometry dimensions reject strings
box('bad',{width:'wide',depth:4,height:3});
// @ts-expect-error existing v1 does not acquire camera support implicitly
const bad:Configuration={schemaVersion:1,camera:{azimuth:45}};
