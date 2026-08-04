import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  StreamableFile,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { UserRole } from '../auth/entities/user.entity';

const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const PDF_CONTENT_TYPE = 'application/pdf';

const reportValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@ApiTags('Reports')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Authentication is required',
})
@ApiForbiddenResponse({
  description: 'Insufficient permissions',
})
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('containers/excel')
  @ApiOperation({ summary: 'Export all containers to Excel' })
  @ApiProduces(EXCEL_CONTENT_TYPE)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel report generated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters or date range',
  })
  async exportAllContainersExcel(
    @Query(reportValidationPipe) query: ReportQueryDto,
  ): Promise<StreamableFile> {
    const buffer = await this.reportsService.generateAllContainersExcel(query);

    return this.createFile(buffer, 'containers-report.xlsx', EXCEL_CONTENT_TYPE);
  }

  @Get('containers/pdf')
  @ApiOperation({ summary: 'Export all containers to PDF' })
  @ApiProduces(PDF_CONTENT_TYPE)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PDF report generated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters or date range',
  })
  async exportAllContainersPdf(
    @Query(reportValidationPipe) query: ReportQueryDto,
  ): Promise<StreamableFile> {
    const buffer = await this.reportsService.generateAllContainersPdf(query);

    return this.createFile(buffer, 'containers-report.pdf', PDF_CONTENT_TYPE);
  }

  @Get('containers/:id/excel')
  @ApiOperation({ summary: 'Export one container to Excel' })
  @ApiParam({
    name: 'id',
    description: 'Container UUID',
    format: 'uuid',
  })
  @ApiProduces(EXCEL_CONTENT_TYPE)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel report generated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid container UUID',
  })
  @ApiNotFoundResponse({
    description: 'Container not found',
  })
  async exportContainerExcel(@Param('id', UUIDValidationPipe) id: string): Promise<StreamableFile> {
    const buffer = await this.reportsService.generateContainerExcel(id);

    return this.createFile(buffer, `container-${id}.xlsx`, EXCEL_CONTENT_TYPE);
  }

  @Get('containers/:id/pdf')
  @ApiOperation({ summary: 'Export one container to PDF' })
  @ApiParam({
    name: 'id',
    description: 'Container UUID',
    format: 'uuid',
  })
  @ApiProduces(PDF_CONTENT_TYPE)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PDF report generated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid container UUID',
  })
  @ApiNotFoundResponse({
    description: 'Container not found',
  })
  async exportContainerPdf(@Param('id', UUIDValidationPipe) id: string): Promise<StreamableFile> {
    const buffer = await this.reportsService.generateContainerPdf(id);

    return this.createFile(buffer, `container-${id}.pdf`, PDF_CONTENT_TYPE);
  }

  private createFile(buffer: Buffer, filename: string, contentType: string): StreamableFile {
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `attachment; filename="${filename}"`,
      length: buffer.length,
    });
  }
}
