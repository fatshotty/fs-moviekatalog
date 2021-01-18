const EventEmitter = require('events');


class BaseEntity extends EventEmitter {

  constructor(model, scopeLibrary) {
    super();
    this._scopeLibrary = scopeLibrary;
    this.model = model || (this.Model ? new this.Model : null) || {};

    if ( !scopeLibrary) {
      throw 'ScopeLibrary is required';
    }

    if ( !this.model ) {
      throw 'No model associated with this entity';
    }
  }

  get _id() {
    return this.model._id ? this.model._id.toString() : '';
  }

  get ScopeLibrary() {
    return this._scopeLibrary;
  }

  get ID() {
    return this.model[ this.Columns.ID ] || this._id;
  }

  get created_at() {
    return this.model.created_at;
  }

  get updated_at() {
    return this.model.updated_at;
  }

  static __dynamic(instance, klass) {

    Object.defineProperty( instance, 'Columns', {
      enumerable: false,
      configurable: true,
      'get': function(v) {
        return klass.Columns
      }
    });
    Object.defineProperty( instance, 'Table', {
      enumerable: false,
      configurable: true,
      'get': function(v) {
        return klass.Table
      }
    });

    let keys = Object.keys(klass.Columns);
    for( let key of keys ) {

      let value = klass.Columns[ key ];
      if ( key == 'ID' || key == 'created_at' || key == 'updated_at' ) {
        continue;
      }

      let descriptor = Object.getOwnPropertyDescriptor( Object.getPrototypeOf(instance), key ) || {enumerable: true, configurable: true};

      descriptor.get = descriptor.get || function() {
        return this.model[ value ]; // || this.data[ `${klass.Table}.${value}`];
      };

      descriptor.enumerable = descriptor.enumerable || true;
      descriptor.configurable = descriptor.configurable || true;

      descriptor.set = descriptor.set || function(v) {
        this.model[ value ] = v;
      };

      Object.defineProperty( instance, key, descriptor )
    }

  }

  static async find(id) {
    return this.findBy( {[this.Columns.ID]: id} )
  }

  static async findBy(fields) {
    let res = await this.Model.findOne( fields );
    return res;
  }

  delete() {
    return this.model.remove ? this.model.remove() : Promise.resolve(false);
  }

  static countBy(fields) {
    return this.Model.countDocuments( fields );
  }

  toJSON() {
    let json = { /*ID: this.ID*/ };
    let keys = Object.keys(this.Columns);
    for( let key of keys ) {
      if ( key === 'ID' ) continue;
      json[ key ] = this[ key ];
    }
    return json;
  }

}


module.exports = BaseEntity;
