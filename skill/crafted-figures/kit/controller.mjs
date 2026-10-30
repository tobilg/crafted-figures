/** Instance-scoped public capture/control boundary. Legacy cleanup functions work. */
export function registerController(root,result,{poses={}}={}){
 const dispose=typeof result==='function'?result:result?.dispose?.bind(result);
 if(!dispose)throw new Error('mount must return a cleanup function or controller with dispose()');
 const controller={};for(const name of ['getState','setState','setTime','pause','resume','getStats'])if(typeof result[name]==='function')controller[name]=result[name].bind(result);
 if(controller.setState)controller.setPose=(name,options)=>{if(!Object.hasOwn(poses,name))throw new Error(`Unknown pose ${name}`);return controller.setState(structuredClone(poses[name]),options);};
 let disposed=false;controller.dispose=()=>{if(disposed)return;disposed=true;dispose();delete root.__craftedController;delete root.dataset.ready;};
 root.__craftedController=controller;root.dataset.ready='true';return controller;
}
