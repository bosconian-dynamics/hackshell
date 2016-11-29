/**
 * Represents a single parameter for a Shell Command, including the argument name, whether or not
 * it's required, and all relevant validation criteria
 */
class CommandArgument {
  constructor( name, validators, required = false, invalidRespose ) {
    this.name           = name
    this.validators     = CommandArgument.processValidators( validators )
    this.required       = required
    this.invalidRespose = invalidRespose

    if( required )
      this.validators.shift( CommandArgument.VALIDATORS[ "required" ]() )
  }

  /**
   * Returns whether or not a given value satisfies all validation criteria
   */
  validate( value ) {
    return this.validators.every( validator => validator( value ) )
  }
}

/**
 * Parses an array of standard validator names, regular expressions, and custom validation
 * functions into an array of validator functions which receive a value and return a boolean
 * representing whether or not the value satisfies the validation criteria
 * @param  {[type]} validators [description]
 * @return {[type]}            [description]
 */
CommandArgument.processValidators = validators => {
  if( !validators || !validators.length )
    return [()=>true]

  if( !(validators instanceof Array) )
    validators = [validators]

  return validators.map( validator => {
    let args = {}

    if( "function" === typeof validator )
      return validator

    if( validator instanceof RegExp )
      return ( arg ) => validator.test( arg )

    if( validator instanceof Array ) {
      args = validator[ 1 ]
      validator = validator[ 0 ]
    }

    if( "string" === typeof validator ) {
      validator = validator.toLowerCase()

      if( !CommandArgument.VALIDATORS[ validator ] )
        throw new Error( `Unknown CommandArgument validator "${validator}"` )

      return CommandArgument.VALIDATORS[ validator ]( args )
    }

    throw new TypeError( `Invalid CommandArgument validator "${validator}": validator must be a String, Function, Array, or RegExp instance`)
  } )
}

/**
 * Standard validation operation factories
 * @type {Object}
 */
CommandArgument.VALIDATORS = {
  "required": ( required = true ) => ( arg ) => required ? ( arg && arg !== null ) : true,
  "every": ( validators ) => {
    validators = CommandArgument.processValidators( validators )

    return ( arg ) => validators.every( validator => validator( arg ) )
  },
  "any": ( validators ) => {
    validators = CommandArgument.processValidators( validators )

    return ( arg ) => validators.some( validator => validator( arg ) )
  },
  "number": ( conditions ) => ( arg ) => {
    if( "number" !== typeof arg )
      return false

    if( !conditions || Object.getOwnPropertyNames( conditions ).length === 0 )
      return true

    for( let condition in conditions ) {
      if( !conditions.hasOwnProperty( condition ) )
        continue

      let parameter = conditions[ condition ]

      if( typeof parameter !== "number" )
        throw new TypeError( `Invalid value "${parameter}" for number argument validator condition ${condition}: must be a Number` )

      switch( condition ) {
        case ">":
        case "gt":
          if( arg <= parameter )
            return false
          break
        case ">=":
        case "gte":
          if( arg < parameter )
            return false
        case "=":
        case "==":
        case "===":
        case "eq":
          if( arg != parameter )
            return false
        case "!":
        case "!=":
        case "!==":
        case "ne":
          if( arg == parameter )
            return false
          break
        case "<":
        case "lt":
          if( arg >= parameter )
            return false
          break
        case "<=":
        case "lte":
          if( arg > parameter )
            return false
          break
        default:
          throw new Error( `Unknown number argument validator condition "${condition}"` )
      }
    }

    return true
  },
  "string": ( conditions ) => {
    if( "string" === typeof conditions ) {
      conditions = {
        "eq": conditions
      }
    }

    return ( arg ) => {
      if( typeof arg !== "string" )
        return false

      if( !conditions || Object.getOwnPropertyNames( conditions ).length === 0 )
        return true

      for( let condition in conditions ) {
        if( !conditions.hasOwnProperty( condition ) )
          continue

        let parameter = conditions[ condition ]
        let invert = false

        if( parameter[0] === "!" && parameter.length > 1 ) {
          invert    = true
          parameter = parameter.substr(1)
        }
        else if( parameter.indexOf( "not" ) === 0 && parameter.length > 3 ) {
          invert    = true
          parameter = parameter.substr( parameter[3] === " " ? 4 : 3 )
        }

        switch( condition ) {
          case "length":
            if( "number" === typeof parameter ) {
              if( arg.length === parameter && !invert )
                continue

              return false
            }

            if( parameter instanceof Object ) {
              let lengthValidator = CommandArgument.VALIDATORS[ "number" ]( parameter )

              if( lengthValidator( arg.length ) && !invert )
                continue
              else
                return false
            }

            throw new TypeError( `Invalid value for string argument validator "length" condition parameter "${parameter}": "length" condition must be a Number or an Object of number validator conditions` )
          case "eq":
          case "=":
          case "==":
          case "===":
          case "is":
            if( arg !== parameter && !invert )
              return false
            break
          case "ne":
          case "!":
          case "not":
            if( arg === parameter && !invert )
              return false
            break
          case "contains":
          case "includes":
          case "has":
            if( "string" === typeof parameter )
              parameter = [parameter]

            for( let needle of parameter ) {
              if( !arg.includes( needle ) && !invert )
                return false
            }
            break
          default:
            throw new Error( `Unknown string argument validator condition "${condition}"` )
        }
      }

      return true
    }
  }
}

export default CommandArgument
