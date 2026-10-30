import Ajv from '../../runtime/ajv.mjs';
import {auditDefaults} from './defaults.mjs';
export {auditDefaults};
const schema={type:'object',additionalProperties:false,properties:{schemaVersion:{const:1},tolerance:{type:'number',exclusiveMinimum:0,maximum:1},exceptions:{type:'array',items:{type:'object',additionalProperties:false,required:['code','parts','reason'],properties:{code:{type:'string',minLength:1},parts:{type:'array',minItems:1,items:{type:'string',minLength:1},uniqueItems:true},detail:{type:'string'},reason:{type:'string',minLength:1}}}}}};
const validate=new Ajv({allErrors:true}).compile(schema);
/** Authored tolerance/exception policy, not a claim that an audit was executed. */
export function resolveAuditPolicy(value={}){if(!validate(value))throw new Error(`figure.auditPolicy: ${JSON.stringify(validate.errors)}`);return {...auditDefaults,...value,exceptions:structuredClone(value.exceptions||[])};}
