export abstract class IMapper<TModal, TDto> {
    abstract toDTO(arg: TModal): TDto;
    toListDTO(arg: TModal[]): TDto[] {
        return arg.map(a => this.toDTO(a))
    }
    abstract toModel(arg: TDto): TModal;
    toListModel(arg: TDto[]): TModal[] {
        return arg.map(a => this.toModel(a))
    }
}