function throwError(message, trace){
    var error = new Error(`\nBlazon error:\n\t${message}\n\nSpec:\n\t${trace}\nSource:`)

    error.stack = error.stack.replace(/^.*\/blazon\/.*$\n/gm, '');

    throw error;
}

function Type(){}
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
            throwError(`Invalid type: Expected castable to String, Got: ${value}`, trace);
        }
        return String(value);
    },
    'Number': (value, trace) => {
        if(typeof value === 'number'){
            return value;
        }

        var result = Number(value);

        if(result != String(value) || isNaN(result)){
            throwError(`Invalid type: Expected castable to Number, Got: ${value}`, trace);
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

        throwError(`Invalid type: Expected castable to Boolean, Got: ${value}`, trace);
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

    throwError(`Invalid type: Expected ${spec.name || spec}, Got: ${value}`, trace);
}

function checkObject(spec, target, data, trace){
    if(data == null || !(data instanceof Object)){
        throwError(`Invalid type: Expected ${spec.name || spec}, Got: ${data}`, trace);
    }

    for(var key in spec){
        var result = check(spec[key], target[key] || {}, data[key], `\`${key}\`: ${trace}`);
        if(result || key in data){
            target[key] = result && result instanceof Default ? result.value : result;
        }
    }

    return target;
}

function check(spec, target, value, trace){
    if(spec == null){
        return spec === value && value;
    } else {
        if(spec.prototype instanceof SubSpec){
            return spec(value);
        }

        if(spec instanceof Type){
            return spec.check(target, value, trace);
        }

        if(isBaseType(spec)){
            return checkBaseType(spec, value, trace);
        } else if(spec instanceof Function){
            if(value && value instanceof spec){
                return value;
            }
        } else if(spec instanceof Object){
            return checkObject(spec, target, value, trace);
        }
    }

    throwError(`Invalid type: Expected ${spec.name || spec}, Got: ${value}`, trace);
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
Maybe.prototype.check = function(target, value, trace){
    if(value == null){
        if('defaultValue' in this){
            return this.defaultValue;
        }

        return value;
    }

    return check(this.spec, target, value, trace);
}

function Null(){
    if(!(this instanceof Null)){
        return new Null();
    }
}
Null.prototype = Object.create(Type.prototype);
Null.prototype.constructor = Null;
Null.prototype.check = function(target, value, trace){
    return value == null;
}

function Custom(validate){
    if(!(this instanceof Custom)){
        return new Custom(validate);
    }

    this.validate = validate;
}
Custom.prototype = Object.create(Type.prototype);
Custom.prototype.constructor = Custom;
Custom.prototype.check = function(target, value, trace){
    return this.validate(value, target);
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
Or.prototype.check = function(target, value, trace){
    var lastError;
    var i = -1;
    while(++i < this.types.length){
        try {
            return check(this.types[i], target, value, trace)
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

function Cast(targetType, customConverter){
    if(!isBaseType(targetType)){
        throw new Error(`Only BaseTypes (${Object.keys(constructors)}) can be cast to`);
    }

    if(!(this instanceof Cast)){
        return new Cast(targetType, customConverter);
    }

    this.targetType = targetType;
    this.customConverter = customConverter;
    return this;
}
Cast.prototype = Object.create(Type.prototype);
Cast.prototype.constructor = Cast;
Cast.prototype.check = function(target, value, trace){
    if(this.customConverter){
        return check(this.targetType, target, this.customConverter(value, target), trace);
    }

    return casts[this.targetType.name](value, trace);
}

function SubSpec(){}

function blazon(spec){
    var stackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 2;
    var trace = (new Error()).stack.match(/at blazon.*\n\s*(.*)/)[1] + '\n';
    Error.stackTraceLimit = stackTraceLimit;
    function Spec(data){
        if(isBaseType(spec)){
            return checkBaseType(spec, data, trace);
        }

        if(!(this instanceof Spec)){
            return Spec.call(Object.create(Spec.prototype), data);
        }

        if(spec instanceof Type){
            return spec.check(this, data, trace);
        }

        return check(spec, this, data, trace);
    }
    Spec.prototype = Object.create(SubSpec.prototype);
    Spec.constructor = Spec;
    Spec.test = function(data, callback){
        try{
            callback(null, Spec(data));
        } catch (error) {
            callback(error);
        }
    }
    Spec.is = function(data){
        try{
            return Spec(data) && true;
        } catch (error) {
            return false;
        }
    }

    return Spec;
}

module.exports = blazon;

function ensure(){
    var specs = [].slice.call(arguments);
    var task = specs.pop();

    return function(){
        var args = specs.map((spec, index) => blazon(spec)(arguments[index]));
        while(args[args.length - 1] instanceof SubSpec){
            args.pop();
        }
        return task.apply(null, args.map(arg => arg && arg instanceof SubSpec ? null : arg));
    };
}

function magic(signature, resultSpec, task){
    var argNames = Object.keys(signature);
    var ResultSpec = arguments.length < 3 ? null : blazon(resultSpec);
    var fnBody = (ResultSpec ? task : resultSpec).toString()
        .match(/^(?:[^]*=>|function.*?)(?:[^]*?{)?([^]*?)}?\n?$/)[1];

    var fn = Function.apply(null, argNames.concat(fnBody));

    if(!ResultSpec){
        return fn;
    }

    return function(){
        var result = fn.apply(this, arguments);
        return ResultSpec(result);
    };
}

module.exports.Maybe = Maybe;
module.exports.Custom = Custom;
module.exports.And = And;
module.exports.Or = Or;
module.exports.Cast = Cast;
module.exports.ensure = ensure;
module.exports.magic = magic;