export const poses={rest:{time:0},mid:{time:1.5},max:{time:3}};
export function measure({time}){if(!Number.isFinite(time))throw new Error('time must be finite');time=Math.max(0,Math.min(3,time));return {time,stroke:2*(1-Math.cos(time*2*Math.PI/3)),reading:`100 linked test plungers · ${time.toFixed(2)} s`};}
