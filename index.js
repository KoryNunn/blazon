function Type(){}
function Default(value){
    this.value = value;
}

var constructors = {
    'String': ''.constructor,
    'Number': (0).constructor,
    'Boolean': true.constructor
}

function isBaseType(spec){
    return (
        spec.name in constructors &&
        constructors[spec.name] === spec
    );
}

function checkBaseType(spec, value){
    if(
        value != null &&
        value.constructor.name === spec.name &&
        value.constructor.name in constructors &&
        value.constructor === constructors[value.constructor.name]
    ){
        return value;
    }

    throw new Error(`Invalid type: Expected ${spec.name || spec}, Got: ${value}`);
}

function checkObject(spec, target, data){
    if(data == null || !(data instanceof Object)){
        throw new Error(`Invalid type: Expected ${spec}, Got: ${data}`);
    }

    for(var key in spec){
        var result = check(spec[key], data[key]);
        if(result || key in data){
            target[key] = result && result instanceof Default ? result.value : result;
        }
    }

    return target;
}

function check(spec, value){
    if(spec && spec.prototype instanceof SubSpec){
        return spec(value);
    }

    if(spec instanceof Type){
        return spec.check(value);
    }

    if(isBaseType(spec)){
        return checkBaseType(spec, value);
    } else if(spec && spec instanceof Object){
        return checkObject(spec, {}, value);
    }

    if(value && value instanceof spec){
        return value;
    }

    throw new Error(`Invalid type: Expected ${spec}, Got: ${value}`);
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
Maybe.prototype.check = function(value){
    if(value == null){
        if('defaultValue' in this){
            return this.defaultValue;
        }

        return value;
    }

    return check(this.spec, value);
}

function Null(){
    if(!(this instanceof Null)){
        return new Null();
    }
}
Null.prototype = Object.create(Type.prototype);
Null.prototype.constructor = Null;
Null.prototype.check = function(value){
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
Custom.prototype.check = function(value){
    return this.validate(value);
}

function Union(){
    if(!(this instanceof Union)){
        return Union.apply(Object.create(Union.prototype), arguments);
    }

    this.types = [].slice.call(arguments);
    return this;
}
Union.prototype = Object.create(Type.prototype);
Union.prototype.constructor = Union;
Union.prototype.check = function(value){
    return this.types.reduce((result, type) => check(type, result), value);
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
Or.prototype.check = function(value){
    var lastError;
    var i = -1;
    while(++i < this.types.length){
        try {
            return check(this.types[i], value)
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

function SubSpec(){}

function blazon(spec){
    function Spec(data){
        if(isBaseType(spec)){
            return checkBaseType(spec, data);
        }

        if(!(this instanceof Spec)){
            return new Spec(data);
        }

        if(spec instanceof Type){
            return spec.check(data);
        }

        checkObject(spec, this, data);

        return this;
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
        .match(/^[^]*=>(?:[^]*?{)?([^]*?)}?\n?$/)[1];

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
module.exports.Union = Union;
module.exports.Or = Or;
module.exports.ensure = ensure;
module.exports.magic = magic;