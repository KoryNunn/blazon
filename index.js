function printValue(value){
    if(typeof value === 'function'){
        return value.toString();
    }

    return JSON.stringify(value, null, 4);
}

function printType(type){
    if(type && type.type){
        return printType(type.type);
    }

    if(type === null){
        return 'null';
    }

    if(type instanceof Type){
        return type.print();
    }

    if(typeof type === 'function'){
        return type.name;
    }

    if(Array.isArray(type)){
        return `Array [ ${printTypes(type)} ]`;
    }

    if(typeof type === 'object'){
        var description = '\nObject {\n';
        for(var key in type){
            description += `\t${key}: ${printType(type[key])}\n`;
        }
        description += '}\n';

        return description;
    }
}

function printTypes(types){
    return types.map(printType).join(', ');
}

function throwError(message, trace){
    var currentStackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 30;
    var error = new Error(`\nBlazon error:\n\t${message}\n\nSpec:\n\t${trace}\nSource:`);
    Error.stackTraceLimit = currentStackTraceLimit;

    error.shortMessage = message;
    error.stack = error.stack.replace(/^.*\/blazon\/index\.js.*$\n/gm, '');

    throw error;
}

function Type(){}
Type.prototype.print = function(){
    return this.constructor.name;
}

function Default(value){
    this.value = value;
}

var constructors = {
    'String': ''.constructor,
    'Number': (0).constructor,
    'Boolean': true.constructor
}

var casts = {
    'String': (value, trace) => {
        if(value && value instanceof Object){
            throwError(`Invalid type: Expected castable to String, Got: ${printValue(value)}`, trace);
        }
        return String(value);
    },
    'Number': (value, trace) => {
        if(typeof value === 'number'){
            return value;
        }

        var result = Number(value);

        if(result != String(value) || isNaN(result)){
            throwError(`Invalid type: Expected castable to Number, Got: ${printValue(value)}`, trace);
        }

        return result;
    },
    'Boolean': (value, trace) => {
        var type = typeof value;

        if(type === 'boolean'){
            return value;
        }

        if(type === 'string' && value === 'true' || value === 'false'){
            return value === 'true';
        }

        if(type === 'number' && value === 0 || value === 1){
            return value !== 0;
        }

        throwError(`Invalid type: Expected castable to Boolean, Got: ${printValue(value)}`, trace);
    }
}

function isBaseType(spec){
    return (
        spec.name in constructors &&
        constructors[spec.name] === spec
    );
}

function checkBaseType(spec, value, trace){
    if(
        value != null &&
        value.constructor.name === spec.name &&
        value.constructor.name in constructors &&
        value.constructor === constructors[value.constructor.name]
    ){
        return value;
    }

    throwError(`Invalid type: Expected ${printType(spec)}, Got: ${printValue(value)}`, trace);
}

function checkObject(spec, target, data, trace){
    if(data == null || !(data instanceof Object)){
        throwError(`Invalid type: Expected ${printType(spec)}, Got: ${data}`, trace);
    }

    Object.keys(spec).map(key => {
        var result = check(spec[key], target[key] || {}, data[key], `\`${key}\`: ${trace}`);
        if(result !== undefined || key in data){
            target[key] = result;
        }
    });

    return target;
}

function check(spec, target, value, trace){
    if(spec.prototype instanceof SubSpec){
        return spec(value);
    }

    if(spec instanceof Type){
        var result = spec.check(target, value, trace);
        return result instanceof Default ? result.value : result
    }

    if(spec.prototype instanceof Type){
        if(spec.length){
            throwError(`Invalid usage: ${spec.name} must be initialized before use, eg: ${spec.toString().match(/function.*?(\w*.*\))/)[0]}`);
        }
        return spec.prototype.check(target, value, trace);
    }

    if(isBaseType(spec)){
        return checkBaseType(spec, value, trace);
    } else if(spec instanceof Function){
        if(value && value instanceof spec){
            return value;
        }
    } else if(spec instanceof Object){
        if(Array.isArray(spec) === Array.isArray(target)){
            return checkObject(spec, target, value, trace);
        }
    }

    throwError(`Invalid type: Expected ${spec.name || spec}, Got: ${printValue(value)}`, trace);
}

function Maybe(spec, defaultValue){
    var hasDefault = arguments.length > 1;

    if(!(this instanceof Maybe)){
        if(hasDefault){
            return new Maybe(spec, defaultValue);
        }
        return new Maybe(spec);
    }

    this.spec = spec;
    if(hasDefault){
        this.defaultValue = new Default(defaultValue);
    }
    return this;
}
Maybe.prototype = Object.create(Type.prototype);
Maybe.prototype.constructor = Maybe;
Maybe.prototype.print = function(){
    var defaultPrint = this.hasDefault ? `, Default: ${this.defaultValue.print()}` : '';
    return `${this.constructor.name}(${printType(this.spec)})${defaultPrint}`
}
Maybe.prototype.check = function(target, value, trace){
    if(value == null){
        if('defaultValue' in this){
            return this.defaultValue;
        }

        return value;
    }

    return check(this.spec, target, value, trace);
}

function Exactly(value){
    if(!(this instanceof Exactly)){
        return new Exactly(value);
    }
    this.exactValue = value;
}
Exactly.prototype = Object.create(Type.prototype);
Exactly.prototype.constructor = Exactly;
Exactly.prototype.print = function () {
    return `Exactly(${JSON.stringify(this.exactValue, null, 4)})`;
}
Exactly.prototype.check = function(target, value, trace){
    if(value === this.exactValue){
        return value;
    }

    throwError(`Invalid type: Expected exactly ${JSON.stringify(this.exactValue)}, Got: ${printValue(value)}`, trace);
}

function Custom(validate){
    if(!(this instanceof Custom)){
        return new Custom(validate);
    }

    this.validate = validate;
}
Custom.prototype = Object.create(Type.prototype);
Custom.prototype.constructor = Custom;
Custom.prototype.print = function(){
    return `${this.constructor.name}(...)`;
}
Custom.prototype.check = function(target, value, trace){
    try {
        return this.validate(value, target, trace);
    } catch (error){
        throwError(error.message);
    }
}

function And(){
    if(!(this instanceof And)){
        return And.apply(Object.create(And.prototype), arguments);
    }

    this.types = [].slice.call(arguments);
    return this;
}
And.prototype = Object.create(Type.prototype);
And.prototype.constructor = And;
And.prototype.print = function(){
    return `${this.constructor.name}(${printTypes(this.types)})`;
}
And.prototype.check = function(target, value, trace){
    return this.types.reduce((result, type) => check(type, target, result, trace), value);
}

function Or(){
    if(!(this instanceof Or)){
        return Or.apply(Object.create(Or.prototype), arguments);
    }

    this.types = [].slice.call(arguments);
    return this;
}
Or.prototype = Object.create(Type.prototype);
Or.prototype.constructor = Or;
Or.prototype.print = function(){
    return `${this.constructor.name}(${printTypes(this.types)})`;
}
Or.prototype.check = function(target, value, trace){
    var errors = [];
    var i = -1;
    while(++i < this.types.length){
        try {
            return check(this.types[i], target, value, trace)
        } catch (error) {
            errors.push(error);
        }
    }

    var descriptions = this.types.map(printType)
        .map((description, typeIndex) => {
            return `\n${description}, which fails with error: ${(errors[typeIndex].shortMessage || String(errors[typeIndex]))}`;
        })
        .join(' OR ');

    throwError(`Invalid type: Expected to be one of ${descriptions}`, trace);
}

function List(type, minLength, maxLength){
    if(!(this instanceof List)){
        return List.apply(Object.create(List.prototype), arguments);
    }

    this.type = type;
    this.minLength = minLength || 0;
    this.maxLength = maxLength || Infinity;
    return this;
}
List.prototype = Object.create(Type.prototype);
List.prototype.constructor = List;
List.prototype.print = function(){
    return `${this.constructor.name}(${printType(this.type)}), minimum length: ${this.minLength}, maximum length: ${this.maxLength}`;
}
List.prototype.check = function(target, value, trace){
    if(!Array.isArray(value)){
        throwError(`Invalid type: Expected Array, Got: ${printValue(value)}`, trace);
    }

    if(value.length < this.minLength){
        throwError(`Invalid type: Expected Array of minimum length ${this.minLength}, Got length: ${value.length}`, trace);
    }

    if(value.length > this.maxLength){
        throwError(`Invalid type: Expected Array of maximum length ${this.maxLength}, Got length: ${value.length}`, trace);
    }

    return value.map(item => check(this.type, value, item, trace))

    throw lastError;
}

function Cast(baseOrSourceType, targetType, customConverter){
    if(!customConverter && !isBaseType(baseOrSourceType)){
        throw new Error(`Only BaseTypes (${Object.keys(constructors)}) can be cast to`);
    }

    if(arguments.length === 2){
        throw new Error(`Cast can only be either Cast(targetBaseType) OR Cast(sourceType, targetType, customConverter)`);
    }

    if(!(this instanceof Cast)){
        return new Cast(baseOrSourceType, targetType, customConverter);
    }

    this.targetType = targetType;
    this.baseOrSourceType = baseOrSourceType;
    this.customConverter = customConverter;
    return this;
}
Cast.prototype = Object.create(Type.prototype);
Cast.prototype.constructor = Cast;
Cast.prototype.print = function(){
    return `${this.constructor.name}(${printType(this.baseOrSourceType)}, ${printType(this.targetType)})`;
}
Cast.prototype.check = function(target, value, trace){
    if(this.customConverter){
        return check(this.targetType, target,
            this.customConverter(
                check(this.baseOrSourceType, target, value),
            target),
        trace);
    }

    return casts[this.baseOrSourceType.name](value, trace);
}

function Any(){
    if(!(this instanceof Any)){
        return new Any();
    }
}
Any.prototype = Object.create(Type.prototype);
Any.prototype.constructor = Any;
Any.prototype.print = function(){
    return `${this.constructor.name}()`;
}
Any.prototype.check = function(target, value, trace){
    return value;
}

function SubSpec(){}

function blazon(type){
    var stackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 2;
    var trace = (new Error()).stack.match(/at blazon.*\n\s*(.*)/)[1] + '\n';
    Error.stackTraceLimit = stackTraceLimit;
    function Spec(data){
        if(isBaseType(type)){
            return checkBaseType(type, data, trace);
        }

        var target = typeof data === 'object' ?
            Array.isArray(data) ? [] :
            {} :
            null;

        return check(type, target, data, trace);
    }
    Spec.prototype = Object.create(SubSpec.prototype);
    Spec.constructor = Spec;
    Spec.type = type;
    Spec.print = function(){
        return printType(this);
    };
    Spec.test = function(data, callback){
        try{
            callback(null, Spec(data));
        } catch (error) {
            callback(error);
        }
    };
    Spec.is = function(data){
        try{
            return Spec(data) && true;
        } catch (error) {
            return false;
        }
    };

    return Spec;
}

module.exports = blazon;

function ensure(){
    var specs = [].slice.call(arguments);
    var task = specs.pop();

    return function(){
        var args = specs.map((spec, index) => blazon(spec)(arguments[index]));

        return task.apply(null, args);
    };
}

module.exports.Maybe = Maybe;
module.exports.Custom = Custom;
module.exports.And = And;
module.exports.Or = Or;
module.exports.List = List;
module.exports.Cast = Cast;
module.exports.Exactly = Exactly;
module.exports.Any = Any;
module.exports.ensure = ensure;